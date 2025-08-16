#!/bin/bash
# Wrapper script to ensure Node.js from nvm is available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Use the specific Node.js version
exec /Users/jonaheaton/.nvm/versions/node/v22.17.1/bin/node "$@"