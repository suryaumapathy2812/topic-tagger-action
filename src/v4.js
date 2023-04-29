const esprima = require('esprima'); // If using Node.js and npm
const fs = require('fs');
const cheerio = require("cheerio");
const { default: axios } = require('axios');

function extractCodeChunks(code) {

    let parsedCode;

    try {
        parsedCode = esprima.parseScript(code, { range: true, tokens: true, comment: true });
    } catch (error) {
        return false
    }

    const chunks = [];
    const extractedRanges = [];

    function isOverlapping(range1, range2) {
        return range1[0] < range2[1] && range1[1] > range2[0];
    }

    function isExtracted(range) {
        for (const extractedRange of extractedRanges) {
            if (isOverlapping(range, extractedRange)) {
                return true;
            }
        }
        return false;
    }

    parsedCode.body.forEach((node) => {
        if (!isExtracted(node.range)) {
            const chunk = code.slice(node.range[0], node.range[1]);
            chunks.push(chunk);
            extractedRanges.push(node.range);
        }
    });

    return chunks;
}

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                mergeDeep(target[key], source[key]);
            } else if (Array.isArray(source[key]) && source[key].length === 0) {
                // Ignore empty arrays
            } else if (typeof source[key] === 'number' && target[key] !== undefined) {
                target[key] += source[key];
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return mergeDeep(target, ...sources);
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

function readCodebase(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
        .filter(({ name: file }) => {

            if (
                file.startsWith('.') ||
                file === 'node_modules' ||
                file === 'dist' ||
                file.includes(".config") ||
                file.includes(".bundle.js") ||
                // file.includes("bootstrap.js") ||
                file.includes(".esm.js") ||
                file.includes(".cjs.js") ||
                file.includes(".min.js") ||
                file.includes(".test.js")
            ) {
                return false;
            } else {
                return true
            }

        });

    const filePaths = entries
        .map(({ name: file }) => {
            const filePath = directory + '/' + file;
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) return readCodebase(filePath)

            if (stats.isFile() && (file.endsWith('.js') || file.endsWith(".html"))) {
                return { path: filePath }
            }
        })
        .filter(entry => entry);

    return filePaths.flat();
}


function extractJsFromHtml(filePath) {
    const htmlContent = fs.readFileSync(filePath.path, 'utf8');
    const $ = cheerio.load(htmlContent);
    const scriptTags = $('script');

    const scripts = [];
    scriptTags.each((_, scriptTag) => {
        const scriptContent = $(scriptTag).html();
        if (scriptContent) {
            scripts.push(scriptContent);
        }
    });

    return scripts;
}

const executionScript = async (directory) => {
    try {

        console.log("Using V4 of topic tagging");

        const filePaths = readCodebase(directory).flat();

        console.info("** File Paths are \n")
        console.info(filePaths.map(file => JSON.stringify(file)))

        let index = 0;

        const implementations = []

        filePaths
            .forEach(async file => {

                console.log(file)
                let code = ''

                if ((file.path).endsWith('.html')) {
                    code = extractJsFromHtml(file).join(" \n\n ");
                    // console.debug(`JavaScript code in ${file}:\n`, JSON.stringify(code, null, 2));
                } else if ((file.path).endsWith('.js')) {
                    const _code = fs.readFileSync(file.path, 'utf8');
                    code = _code;
                }

                const codeChunks = extractCodeChunks(code);

                if (codeChunks === false) {
                    console.debug(`Skipping file due to error`);
                    index++
                    return
                }

                const response = []
                for (const chunk of codeChunks) {
                    const result = { chunk };
                    const concepts = await axios.post("https://core.api.learn2build.in/api/v4/javascript", {
                        body: JSON.stringify({
                            "sourceLanguage": "JavaScript",
                            "targetLanguage": "JavaScript",
                            "code": chunk
                        }),
                        headers: { 'Content-Type': 'application/json' }
                    })
                    result["concepts"] = concepts.data
                    response.push(result);
                }

                const analysisResults = await Promise
                    .all(response);

                console.log(JSON.stringify(analysisResults, null, 2))


                const temporary = analysisResults
                    .reduce((accumulator, currentObject) => mergeDeep(accumulator, currentObject), {});

                console.log(temporary)

                const finalResult = temporary.concepts;
                filePaths[index]["topics"] = finalResult
                index++
                implementations.push(finalResult);
            })

        const consolidatedData = implementations
            .reduce((accumulator, currentObject) => mergeDeep(accumulator, currentObject), {});

        console.debug('Implemented Topics are: \n')
        console.debug(JSON.stringify(consolidatedData, null, 2))
        return consolidatedData

    } catch (error) {
        console.error(error);
    }
}

module.exports = executionScript