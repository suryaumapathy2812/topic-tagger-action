const core = require('@actions/core');
const github = require('@actions/github');

const formatTable = (oldTopicOutput, newTopicOutput) => {
    let tableRows = '';
    for (const topic in newTopicOutput) {
        for (const subtopic in newTopicOutput[topic]) {
            core.info("oldTopicOutput[topic] =>>>>>>>>>>>>  \n" + JSON.stringify(oldTopicOutput[topic], null, 2))
            const oldCount = (oldTopicOutput[topic] && oldTopicOutput[topic][subtopic]) ? oldTopicOutput[topic][subtopic] : 0;
            const newCount = newTopicOutput[topic][subtopic];
            core.info("new count =>>>>>>>>>> " + newCount)
            core.info("old count =>>>>>>>>>> " + oldCount)
            const diffCount = newCount - oldCount;
            const diffSign = diffCount > 0 ? `+ ` : (diffCount < 0 ? `- ` : `0`);

            core.info(`diffcount =>>>>>>>>>> ${diffCount}`)

            tableRows += `| ${topic} | ${subtopic} | ${newCount} (${diffSign}${diffCount}) |\n`;
        }
    }
    return tableRows;
};


const handleComment = async (newTopicOutput, oldTopicOutput) => {
    core.debug("Entering handleComment")

    const tableData = formatTable(oldTopicOutput, newTopicOutput);

    core.info(JSON.stringify(tableData))


    const octokit = github.getOctokit(core.getInput('github_token'));
    const context = github.context;
    core.debug(JSON.stringify(context, null, 2))


    const fullName = context.payload.repository.full_name;
    const [owner, repo] = fullName.split("/");

    // Get the pull request number from the event
    let pullRequestId;
    if (context.issue.number) {
        // Return issue number if present
        pullRequestId = context.issue.number;
    } else {
        // Otherwise return issue number from commit
        pullRequestId = (
            await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
                // eslint-disable-next-line camelcase
                commit_sha: context.sha,
                owner,
                repo
            })
        ).data[0].number;
    }
    core.info(pullRequestId)


    // Retrieve comments for the current pull request
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
        owner,
        repo,
        // eslint-disable-next-line camelcase
        issue_number: pullRequestId,
    });
    core.info(JSON.stringify(comments, null, 2));


    const generatedComment = comments.find((comment) => comment.body.includes('<!-- GENERATED_TOPIC_TABLE -->'));
    core.debug(JSON.stringify(generatedComment, null, 2));

    let result;

    if (!generatedComment) {
        core.info('Creating new Comment')
        result = await octokit.rest.issues.createComment({
            owner,
            repo,
            // eslint-disable-next-line camelcase
            issue_number: pullRequestId,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${tableData}`
        });
        core.info('New comment created.');
    } else {
        core.info('Updating Existing Comment');
        result = await octokit.rest.issues.updateComment({
            owner,
            repo,
            // eslint-disable-next-line camelcase
            comment_id: generatedComment.id,
            body: `<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count (Difference) |\n|----------------|------------------------|--------------------|\n${tableData}`
        });
        core.info('Existing comment updated.');
    }

    core.info('Exiting handleComment');

    return result

};


module.exports = handleComment
