const core = require('@actions/core');
const github = require("@actions/github");
const fetch = require("node-fetch");
const fs = require("fs");
const { pipeline } = require("stream");
const { promisify } = require("util");
const streamPipeline = promisify(pipeline);
const extract = require("extract-zip");
const path = require('path');

const downloadArtifact = async () => {
    core.debug("Entering downloadArtifact")

    const token = core.getInput('github_token');
    core.debug(token)
    const artifactName = "latest-results";

    const octokit = github.getOctokit(token);
    const context = github.context;
    const fullName = context.payload.repository.full_name;

    const [owner, repo] = fullName.split("/");

    const absolutePath = path.resolve("./");
    const outputPath = absolutePath + "/records"

    const workflowPath = github.context.workflow.split("/")
    const workflowIdOrFileName = workflowPath[workflowPath.length - 1];
    core.info(workflowIdOrFileName)

    const { data: runs } = await octokit.rest.actions.listWorkflowRuns({
        owner,
        repo,
        // eslint-disable-next-line camelcase
        workflow_id: workflowIdOrFileName,
        status: "success",
    });

    if (runs.workflow_runs.length === 0) {
        core.info("No successful workflow runs found");
        return;
    }


    const runId = runs.workflow_runs[0].id;
    const { data: artifacts } = await octokit.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        // eslint-disable-next-line camelcase
        run_id: runId,
    });

    const artifact = artifacts.artifacts.find((a) => a.name === artifactName);

    if (!artifact) {
        core.info("Artifact not found");
        return;
    }

    const downloadUrl = artifact.archive_download_url;
    const response = await fetch(downloadUrl, {
        headers: { Authorization: `token ${token}` },
    });

    if (!response.ok) {
        throw new Error(`Failed to download artifact: ${response.statusText}`);
    }

    await fs.promises.mkdir(outputPath, { recursive: true });
    const zipPath = `${outputPath}/artifact.zip`;
    await streamPipeline(response.body, fs.createWriteStream(zipPath));

    core.info(`Artifact downloaded to ${zipPath}`);

    // Extract the JSON file from the .zip artifact
    await extract(zipPath, { dir: outputPath });
    core.info(`Artifact extracted to ${outputPath}`);


    core.info(`Artifact extracted to ${fs.readdirSync(outputPath)}`);

    // Delete the .zip file
    fs.unlinkSync(zipPath);

    const result = fs.readFileSync(outputPath + '/topic_tagger_results.json', 'utf-8')
    core.info(" records ======================================== >")
    core.info(result)
    core.info(" records ======================================== >")

    return result;
};


module.exports = downloadArtifact

