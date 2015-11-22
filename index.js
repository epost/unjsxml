"use strict";

var fs       = require('fs');
var path     = require('path');
var mkdirp   = require('mkdirp');
var libxmljs = require('libxmljs');
var R        = require('ramda');

const projectRootDir   = process.argv[2],
      outDir           = process.argv[3],
      sourceEntryPoint = "xsltforms.js.xml",
      sourceRootDir    = projectRootDir + path.sep + "src",
      configFile       = projectRootDir + path.sep + "txs" + path.sep + "cm_config.xml",
      nsUri            = { cm: "http://www.agencexml.com/cm" },
      stripExtensions  = filename => filename.split(".")[0],
      cons             = (x, xs) => R.concat([x], xs),
      fixFileName = f => outDir + path.sep + f.replace(/\.js\.xml/g, '.js');

(function main() {
    console.error("root source file:", sourceRootDir + path.sep + sourceEntryPoint);
    console.error("unpacking .js.xml to .js source files in:", outDir);

    const configProperties = parseConfigFile(configFile);
    // console.log('config:\n\n', configProperties);

    // analyse imports and write .js files
    const importsTree = writeJsFilesRecursive(configProperties)(sourceEntryPoint);

    console.error("imports in order:");
    dumpImportsRecursive_(importsTree);

    // create DOT graph of imports
    // TODO if we still want the DOT graph, we need to turn this tree back into an adjacency list like we had before
    // fs.writeFileSync(outDir + path.sep + "imports.dot", importsToGraphViz(imports));
})();


/**
 * @param pc '{ importPairs :: [{ parent :: Path, child :: Path}],
 *              imports     :: [Path],
 *              sourceText  :: [String]
 *            } where Path = String'
 */
function dumpImportsRecursive_(pc) {
    R.forEach(dumpImportsRecursive_, pc.children);
    console.log(fixFileName(pc.parent));
}

// curried
function writeJsFilesRecursive(configProperties) {
    return function(sourceFileRelativeToSourceRoot) {

        const sourceSubDir          = path.dirname(sourceFileRelativeToSourceRoot),
              sourceBaseName        = path.basename(sourceFileRelativeToSourceRoot),
              sourcePathAndFileName = sourceSubDir + path.sep + sourceBaseName,
              outFile               = outDir + path.sep + sourceSubDir + path.sep + stripExtensions(sourceBaseName) + '.js';

        if (0) {
            console.log("writeJsFilesRecursive:");
            console.log("sourceRootDir                  = ", sourceRootDir);
            console.log("sourceSubDir                   = ", sourceSubDir);
            console.log("sourceBaseName                 = ", sourceBaseName);
            console.log("sourceFileRelativeToSourceRoot = ", sourceFileRelativeToSourceRoot);
            console.log("outFile                        = ", outFile);
            console.log("sourcePathAndFileName          = ", sourcePathAndFileName);
            console.log("");
        };

        const parsed = parseXmlJsFile(configProperties, sourcePathAndFileName);

        mkdirp.sync(path.dirname(outFile));

        fs.writeFile(outFile, parsed.sourceFragments.join(''), function(err) {
            if (err) { throw err; }
            // console.log("saved: " + outFile);
        });

        return { parent:   sourcePathAndFileName
               , children: R.map(R.compose(writeJsFilesRecursive(configProperties), path => sourceSubDir + path.sep + path), parsed.imports)
               };
    };
}

function parseConfigFile(file) {
    const xmlBuf = fs.readFileSync(file);
    const doc = libxmljs.parseXml(xmlBuf.toString(), { nocdata: true });
    return R.mergeAll(R.map(node => R.objOf(node.name(), node.text()), doc.find("/cm:config/*", nsUri)));
}

/**
 * @return  '{ importPairs :: [{ parent :: Path, child :: Path}],
 *             imports     :: [Path],
 *             sourceText  :: [String]
 *           }  where Path = String'
 */
function parseXmlJsFile(configProperties, sourceFile) {
    const xmlBuf = fs.readFileSync(sourceRootDir + path.sep + sourceFile);
    const parsed = parseSync(configProperties, xmlBuf.toString());
    return R.merge({ importPairs: R.map(imported => ({ parent: sourceFile, child: imported }), parsed.imports) }, parsed);
}


/**
 * @param   configProperties A map of the form '{ versionNumber: 123, license: "Lorem ipsum..." }'.
 * @return  '{ imports :: [Path], sourceText :: [String] } where Path = String'
 */
function parseSync(configProperties, xmlStr) {

    const doc = libxmljs.parseXml(xmlStr, { nocdata: true });

    const imports = doc
        .find("cm:source/cm:import-components/@path", nsUri)
        .map(attr => attr.value());

    const sourceFragments = doc.find("(cm:source/cm:wiki | cm:source/text() | cm:source/cm:value)", nsUri)
        .map(node => {
            switch (node.name()) {
                case "text":  return node.text(); break;
                case "wiki":  return wikiTextToComment(node.text()); break;
                case "value": const valueIdentifier = node.attr("name").value(); return configProperties[valueIdentifier]; break;
                default:      return "";
            };
        });

    return { imports: imports, sourceFragments: sourceFragments };
};

function wikiTextToComment(wikiText) {
    return ""
         + "\n"
         + "/**"
         + wikiText.replace(/\n/g,"\n * ")
         + "\n"
         + " */"
         ;
}

function importsToGraphViz(imports) {
    return ""
         + 'digraph imports {\n'
         + '\n'
         +  R.map(i => '  \"' + i.parent + '\" -> \"' + i.child + '\"\n', imports).join('')
         + '}'
         ;
}
