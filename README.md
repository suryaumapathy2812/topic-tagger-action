# JavaScript Topic Tagging GitHub Action

This GitHub Action generates an list of JavaScript and Concepts that are implemented in the codebase.

## Example Workflow

Here's an example workflow file on how to setup the Topic-Tagger GitHub Action:

```yaml

on:
  pull_request:
    types: [opened, synchronize]
  push:
    branches-ignore:
      - main

jobs:
  hello_world_job:
    runs-on: ubuntu-latest
    name: Topic Tagging
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Topic Tagger
        id: topic-tagger
        uses: suryaumapathy2812/topic-tagger-action@v1
        with:
          start-point: "./"
          version: "v4"
      - name: Create or update comment
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TABLE_DATA: ${{ steps.format-table.outputs.tableData }}
        run: |
          comment_id="${{ steps.topic-tagger.outputs.tags_comment_id }}"
          
          if [ -z "$comment_id" ] || [ "$comment_id" == "null" ]; then
            new_comment=$(gh api repos/${{ github.repository }}/issues/${{ github.event.pull_request.number }}/comments -f body="<!-- GENERATED_TOPIC_TABLE -->\n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${TABLE_DATA}")
            echo "New comment created."
          else
            gh api repos/${{ github.repository }}/issues/comments/$comment_id -X PATCH -f body="<!-- GENERATED_TOPIC_TABLE --> \n\n**List of Implemented Topics:**\n\n| Topic          | Subtopic               | Count |\n|----------------|------------------------|-------|\n${TABLE_DATA}"
            echo "Existing comment updated."
          fi

```