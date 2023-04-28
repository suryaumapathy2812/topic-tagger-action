const core = require('@actions/core');
const topicTagger = require('./src/topicTagger');
const fs = require('fs');
const path = require("path");

// most @actions toolkit packages have async methods
async function run() {
  try {
    const startPoint = core.getInput('start-point');
    core.info(`Starting point will be  ${startPoint}`);

    const version = core.getInput('version');
    core.info(`The version will be using is: ${version}`);

    const commitId = (process.env.GITHUB_SHA) ? process.env.GITHUB_SHA : null;
    core.info(`Current commit ID: ${commitId}`);


    let filePaths;
    switch (version) {
      case "v1":
        filePaths = topicTagger.v1(startPoint);
        break;
      case "v2":
        filePaths = topicTagger.v2(startPoint);
        break;
      case "v3":
        filePaths = topicTagger.v3(startPoint);
        break;
      case "v4":
        filePaths = topicTagger.v4(startPoint);
        break;
      default:
        filePaths = topicTagger.v4(startPoint);
        break;
    }


    core.debug(JSON.stringify(filePaths)); // debug is only output if you set the secret `ACTIONS_RUNNER_DEBUG` to true

    const tags = filePaths

    core.info('JavaScript topics used in the codebase:');
    core.info(JSON.stringify(tags, null, 4));

    core.setOutput('tags', tags);
    core.setOutput('tags_comment_id', commitId);

    const commentResult = await topicTagger.handleComment(tags).catch((error) => {
      core.setFailed(error.message);
    });

    core.info(JSON.stringify(commentResult, null, 2))
    const previousResult = getPreviousResult();
    core.info(previousResult)
    writeToFile(startPoint, tags);

  } catch (error) {
    core.setFailed(error.message);
  }
}

function getPreviousResult() {
  try {
    const absolutePath = path.resolve("./");
    core.info(absolutePath)
    const records = absolutePath + "/records/latest-results.json"
    core.info(records)
    const result = fs.readFileSync(records, 'utf-8')
    core.info(" records ======================================== >")
    core.info(result)
    core.info(" records ======================================== >")
    return JSON.parse(records);
  } catch (error) {
    return false;
  }
}


function writeToFile(startPoint, content) {
  const absolutePath = path.resolve(startPoint);
  core.info(absolutePath)

  const writePath = absolutePath + "/output/topic_tagger_results.json"
  core.info(writePath)

  fs.writeFileSync(writePath, JSON.stringify(content));

  core.info("File written successfully\n");
  core.info("The written has the following contents:");
  core.debug(fs.readFileSync(writePath, "utf8"));

}


(async () => {
  await run();
})()
