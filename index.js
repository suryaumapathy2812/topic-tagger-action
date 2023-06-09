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

    const commentResult = await topicTagger.handleComment(tags)
      .catch((error) => {
        core.setFailed(error.message);
      });

    core.info(JSON.stringify(commentResult, null, 2))

    const previousResult = await topicTagger.downloadArtifact()
      .catch((error) => {
        console.error(error);
        process.exit(1);
      });
    core.info(previousResult)
    writeToFile(startPoint, tags);

  } catch (error) {
    core.setFailed(error.message);
  }
}


function writeToFile(startPoint, content) {
  const fileName = "/topic_tagger_results.json"

  const absolutePath = path.resolve(startPoint);
  core.info(absolutePath)

  const writePath = absolutePath + "/output"
  core.info(writePath)

  if (!fs.existsSync(writePath)) {
    fs.mkdirSync(writePath);
  }

  core.info(JSON.stringify(content, null, 2))

  core.info(writePath + fileName)
  fs.writeFileSync(writePath + fileName, JSON.stringify(content), 'utf-8');

  core.info("File written successfully\n");
  core.info("The written has the following contents:");
  core.debug(fs.readFileSync(writePath + fileName, "utf-8"));

}


(async () => {
  await run();
})()
