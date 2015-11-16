src=~/dev/3rdparty/xsltforms/src/xsltforms.js.xml
targetDir=/tmp/unjsxml

all:
	node index.js ${src} ${targetDir}

graph:${targetDir}/imports.dot
#	dot -Kdot -Tsvg -O ${targetDir}/imports.dot
#	dot -Ktwopi -Tsvg -O ${targetDir}/imports.dot
	dot -Kcirco -Tsvg -O ${targetDir}/imports.dot

view_mac:
	open ${targetDir}/imports.dot.svg
