const fs = require("fs")
const core = require("@actions/core")
const cheerio = require("cheerio");
// const esprima = require('esprima');
const { default: axios } = require("axios");

// function isOverlapping(range1, range2) {
//     return range1[0] < range2[1] && range1[1] > range2[0];
// }


// function isExtracted(range, extractedRanges) {
//     for (const extractedRange of extractedRanges) {
//         if (isOverlapping(range, extractedRange)) {
//             return true;
//         }
//     }
//     return false;
// }


// function extractCodeChunks(code) {

//     let parsedCode;

//     try {
//         parsedCode = esprima.parseScript(code, { range: true, tokens: true, comment: true });
//     } catch (error) {
//         return false
//     }

//     const chunks = [];
//     const extractedRanges = [];


//     parsedCode.body.forEach((node) => {
//         if (!isExtracted(node.range), extractedRanges) {
//             const chunk = code.slice(node.range[0], node.range[1]);
//             chunks.push(chunk);
//             extractedRanges.push(node.range);
//         }
//     });

//     return chunks;
// }


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

function extractJsCode(file) {

    let code;

    if ((file.path).endsWith('.html')) {
        code = extractJsFromHtml(file).join(" \n\n ");
        // console.debug(`JavaScript code in ${file}:\n`, JSON.stringify(code, null, 2));
    } else if ((file.path).endsWith('.js')) {
        const _code = fs.readFileSync(file.path, 'utf8');
        code = _code;
    }

    return code;

}


async function tagTopics(code) {
    try {
        const { concepts } = (
            await axios.post("https://core.api.learn2build.in/api/v4/javascript", {
                body: {
                    "sourceLanguage": "JavaScript",
                    "targetLanguage": "JavaScript",
                    "code": code
                },
                headers: { 'Content-Type': 'application/json' }
            })).data

        return (await concepts)
    } catch (error) {
        core.error(error.message)
        throw new Error(error.message, error.status)
    }
}


module.exports = { readCodebase, extractJsCode, extractJsFromHtml, tagTopics }