"use strict";

var fs       = require('fs');
var path     = require('path');
var mkdirp   = require('mkdirp');
var libxmljs = require('libxmljs');
var R        = require('ramda');

const sourceRootDir    = path.dirname(process.argv[2]),
      sourceEntryPoint = path.basename(process.argv[2]),
      outDir           = process.argv[3],
      stripExtensions  = filename => filename.split(".")[0];


(function main() {
    console.log("root source file :", sourceRootDir + "/" + sourceEntryPoint);
    console.log("target dir       :", outDir);

    // analyse imports and write .js files
    const imports = writeJsFilesRecursive({ parent: null, child: sourceEntryPoint});

    // create DOT graph of imports
    fs.writeFileSync(outDir + "/" + "imports.dot", importsToGraphViz(imports));
})();


function writeJsFilesRecursive(pair) {

    const sourceFileRelativeToSourceRoot = pair.child;

    const sourceSubDir          = path.dirname(sourceFileRelativeToSourceRoot),
          sourceBaseName        = path.basename(sourceFileRelativeToSourceRoot),
          sourcePathAndFileName = sourceSubDir + "/" + sourceBaseName,
          outFile               = outDir + "/" + sourceSubDir + "/" + stripExtensions(sourceBaseName) + '.js';

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

    const parsed = parseXmlJsFile(sourcePathAndFileName);

    mkdirp.sync(path.dirname(outFile));

    fs.writeFile(outFile, parsed.sourceFragments.join(''), function(err) {
        if (err) { throw err; }
        // console.log("saved: " + outFile);
    });

    // TODO adding the subdir should probably be done in the other function
    const importsQPairs = R.map(pc => ({ parent: pc.parent, child: sourceSubDir + "/" + pc.child }), parsed.importPairs);
    return R.concat(importsQPairs, R.flatten(R.map(writeJsFilesRecursive, importsQPairs)));
}

/**
 * @return  '{ importPairs :: [{ parent :: Path, child :: Path}],
 *             imports     :: [Path],
 *             sourceText  :: [String]
 *           }  where Path = String'
 */
function parseXmlJsFile(sourceFile) {
    const xmlBuf = fs.readFileSync(sourceRootDir + "/" + sourceFile);
    const parsed = parseSync(xmlBuf.toString());
    return R.merge({ importPairs: R.map(imported => ({ parent: sourceFile, child: imported }), parsed.imports) }, parsed);
}


/**
 * @return  '{ imports :: [Path], sourceText :: [String] } where Path = String'
 */
function parseSync(xmlStr) {

    const doc = libxmljs.parseXml(xmlStr, { nocdata: true });

    const nsUri = {cm: "http://www.agencexml.com/cm"};

    const imports = doc
        .find("cm:source/cm:import-components/@path", nsUri)
        .map(attr => attr.value());

    const sourceFragments = doc.find("(cm:source/cm:wiki | cm:source/text())", nsUri)
        .map(node => {
            switch (node.name()) {
                case "text": return node.text(); break;
                case "wiki": return wikiTextToComment(node.text()); break;
                default:     return "";
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
