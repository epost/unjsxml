src=~/dev/3rdparty/xsltforms
targetDir=/tmp/unjsxml

all:
	node index.js ${src} ${targetDir}

graph:${targetDir}/imports.dot
	dot -Kcirco -Tsvg -O ${targetDir}/imports.dot

view_mac:
	open ${targetDir}/imports.dot.svg
