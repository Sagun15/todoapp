const git = require('isomorphic-git');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0];

async function runGit() {
  const dir = process.cwd();
  
  try {
    switch (command) {
      case 'init':
        await git.init({ fs, dir, defaultBranch: 'main' });
        
        // Create an initial empty commit to establish HEAD
        try {
          await git.commit({
            fs,
            dir,
            message: 'Initial commit',
            author: {
              name: 'Bolt User',
              email: 'user@bolt.new'
            },
            tree: await git.writeTree({ fs, dir })
          });
          console.log('Initialized Git repository with initial commit');
        } catch (commitError) {
          // If commit fails, just initialize normally
          console.log('Initialized empty Git repository');
        }
        break;
        
      case 'status':
        const matrix = await git.statusMatrix({ fs, dir });
        
        // Filter out files we want to ignore
        const filteredMatrix = matrix.filter(([file]) => {
          return !file.startsWith('node_modules/') && 
                 !file.startsWith('.git/') &&
                 !file.startsWith('.DS_Store') &&
                 !file.endsWith('.log') &&
                 file !== 'package-lock.json' &&
                 file !== 'yarn.lock' &&
                 file !== 'pnpm-lock.yaml';
        });
        
        // Get current branch
        let currentBranch = 'main';
        try {
          currentBranch = await git.currentBranch({ fs, dir }) || 'main';
        } catch (branchError) {
          // Default to main if can't determine
        }
        
        if (filteredMatrix.length === 0) {
          console.log('On branch ' + currentBranch);
          console.log('nothing to commit, working tree clean');
        } else {
          console.log('On branch ' + currentBranch);
          
          // Separate staged and unstaged changes
          const stagedFiles = [];
          const unstagedFiles = [];
          
          filteredMatrix.forEach(([file, head, workdir, stage]) => {
            // Status matrix: [filename, headStatus, workdirStatus, stageStatus]
            // 0 = absent, 1 = present and same, 2 = present and different
            
            if (stage === 2) {
              // File is staged (different in stage vs head)
              if (head === 0) {
                stagedFiles.push(['new file', file]);
              } else if (head === 1) {
                stagedFiles.push(['modified', file]);
              }
            } else if (workdir === 2 && stage !== 2) {
              // File is modified in workdir but not staged
              if (head === 0) {
                unstagedFiles.push(['new file', file]);
              } else if (head === 1) {
                unstagedFiles.push(['modified', file]);
              }
            }
          });
          
          if (stagedFiles.length > 0) {
            console.log('Changes to be committed:');
            stagedFiles.forEach(([status, file]) => {
              console.log('  ' + status + ':   ' + file);
            });
            console.log('');
          }
          
          if (unstagedFiles.length > 0) {
            console.log('Changes not staged for commit:');
            unstagedFiles.forEach(([status, file]) => {
              console.log('  ' + status + ':   ' + file);
            });
          }
        }
        break;
        
      case 'add':
        const filepath = args[1] || '.';
        if (filepath === '.') {
          const files = [];
          function getAllFiles(dir, base = dir) {
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
              if (entry.startsWith('.') || entry === 'node_modules') continue;
              const full = dir + '/' + entry;
              const stat = fs.statSync(full);
              if (stat.isDirectory()) {
                getAllFiles(full, base);
              } else {
                files.push(full.replace(base + '/', ''));
              }
            }
          }
          getAllFiles(dir);
          
          let addedCount = 0;
          for (const file of files) {
            try {
              await git.add({ fs, dir, filepath: file });
              addedCount++;
            } catch (e) {
              // Skip files that can't be added
            }
          }
          console.log('Added ' + addedCount + ' files');
        } else {
          await git.add({ fs, dir, filepath });
          console.log('Added ' + filepath);
        }
        break;
        
      case 'commit':
        const messageFlag = args.indexOf('-m');
        const message = messageFlag !== -1 && args[messageFlag + 1] 
          ? args[messageFlag + 1] 
          : 'Initial commit';
          
        const sha = await git.commit({
          fs, 
          dir, 
          message,
          author: { 
            name: 'Bolt User', 
            email: 'user@bolt.new' 
          }
        });
        
        console.log('[main ' + sha.substring(0, 7) + '] ' + message);
        break;
        
      case 'log':
        const commits = await git.log({ fs, dir, depth: 5 });
        if (commits.length === 0) {
          console.log('No commits yet');
        } else {
          commits.forEach(commit => {
            console.log('commit ' + commit.oid);
            console.log('Author: ' + commit.commit.author.name + ' <' + commit.commit.author.email + '>');
            console.log('Date: ' + new Date(commit.commit.author.timestamp * 1000).toISOString());
            console.log('');
            console.log('    ' + commit.commit.message);
            console.log('');
          });
        }
        break;
        
      case 'remote':
        if (args[1] === 'add' && args[2] && args[3]) {
          const remoteName = args[2];
          let remoteUrl = args[3];
          
          // Convert SSH URLs to HTTPS
          if (remoteUrl.startsWith('git@github.com:')) {
            remoteUrl = remoteUrl.replace('git@github.com:', 'https://github.com/');
            if (!remoteUrl.endsWith('.git')) {
              remoteUrl += '.git';
            }
            console.log('Converting SSH URL to HTTPS: ' + remoteUrl);
          }
          
          await git.addRemote({ fs, dir, remote: remoteName, url: remoteUrl });
          console.log('Added remote ' + remoteName + ': ' + remoteUrl);
        } else if (args[1] === 'remove' && args[2]) {
          const remoteName = args[2];
          try {
            await git.deleteRemote({ fs, dir, remote: remoteName });
            console.log('Removed remote ' + remoteName);
          } catch (removeError) {
            console.log('Failed to remove remote: ' + removeError.message);
          }
        } else if (args[1] === '-v' || !args[1]) {
          const remotes = await git.listRemotes({ fs, dir });
          if (remotes.length === 0) {
            console.log('No remotes configured');
          } else {
            remotes.forEach(remote => {
              console.log(remote.remote + '\t' + remote.url + ' (fetch)');
              console.log(remote.remote + '\t' + remote.url + ' (push)');
            });
          }
        } else {
          console.log('Usage: node mygit.cjs remote add <name> <url>');
          console.log('       node mygit.cjs remote remove <name>');
          console.log('       node mygit.cjs remote -v');
        }
        break;
        
      case 'push':
        // Parse arguments: push [-u] [remote] [branch]
        let remoteName = 'origin';
        let branchName = 'main';
        let argIndex = 1; // Skip 'push'
        
        // Skip -u flag if present
        if (args[argIndex] === '-u') {
          argIndex++;
        }
        
        // Get remote name if provided
        if (args[argIndex]) {
          remoteName = args[argIndex];
          argIndex++;
        }
        
        // Get branch name if provided
        if (args[argIndex]) {
          branchName = args[argIndex];
        }
        
        console.log('Pushing to ' + remoteName + '/' + branchName + '...');
        
        try {
          // First try without authentication (for public repos)
          await git.push({
            fs,
            http: require('isomorphic-git/http/node'),
            dir,
            remote: remoteName,
            ref: branchName,
            onAuth: () => {
              // Only provide auth if GITHUB_TOKEN is set
              if (process.env.GITHUB_TOKEN) {
                console.log('Using GitHub token for authentication');
                return { username: 'token', password: process.env.GITHUB_TOKEN };
              } else {
                console.log('No authentication provided (trying as public repo)');
                return { cancel: true };
              }
            },
            onAuthFailure: () => {
              console.log('Authentication failed.');
              console.log('For private repos, set GITHUB_TOKEN environment variable.');
              return { cancel: true };
            }
          });
          console.log('Successfully pushed to ' + remoteName + '/' + branchName);
        } catch (pushError) {
          if (pushError.message.includes('authentication') || pushError.message.includes('401')) {
            console.log('Push failed: Authentication required');
            console.log('This might be a private repository.');
            console.log('For private repos, you need to set a GitHub token:');
            console.log('  export GITHUB_TOKEN=your_personal_access_token');
          } else if (pushError.message.includes('404')) {
            console.log('Push failed: Repository not found');
            console.log('Make sure the repository exists and the URL is correct');
          } else {
            console.log('Push failed: ' + pushError.message);
            console.log('Make sure the remote repository exists and you have push access');
          }
        }
        break;
        
      case 'pull':
        const pullRemote = args[1] || 'origin';
        const pullBranch = args[2] || 'main';
        
        console.log('Pulling from ' + pullRemote + '/' + pullBranch + '...');
        
        try {
          await git.pull({
            fs,
            http: require('isomorphic-git/http/node'),
            dir,
            ref: pullBranch,
            remote: pullRemote,
            onAuth: () => {
              if (process.env.GITHUB_TOKEN) {
                return { username: 'token', password: process.env.GITHUB_TOKEN };
              } else {
                return { cancel: true };
              }
            },
            author: {
              name: 'Bolt User',
              email: 'user@bolt.new'
            }
          });
          console.log('Successfully pulled from ' + pullRemote + '/' + pullBranch);
        } catch (pullError) {
          console.log('Pull failed: ' + pullError.message);
        }
        break;
        
      case 'fetch':
        if (args[1] === '--all') {
          console.log('Fetching all remotes...');
          try {
            const remotes = await git.listRemotes({ fs, dir });
            for (const remote of remotes) {
              console.log('Fetching ' + remote.remote + '...');
              await git.fetch({
                fs,
                http: require('isomorphic-git/http/node'),
                dir,
                remote: remote.remote,
                onAuth: () => {
                  if (process.env.GITHUB_TOKEN) {
                    return { username: 'token', password: process.env.GITHUB_TOKEN };
                  } else {
                    return { cancel: true };
                  }
                }
              });
            }
            console.log('Fetch completed for all remotes');
          } catch (fetchError) {
            console.log('Fetch failed: ' + fetchError.message);
          }
        } else {
          const fetchRemote = args[1] || 'origin';
          console.log('Fetching from ' + fetchRemote + '...');
          try {
            await git.fetch({
              fs,
              http: require('isomorphic-git/http/node'),
              dir,
              remote: fetchRemote,
              onAuth: () => {
                if (process.env.GITHUB_TOKEN) {
                  return { username: 'token', password: process.env.GITHUB_TOKEN };
                } else {
                  return { cancel: true };
                }
              }
            });
            console.log('Fetch completed from ' + fetchRemote);
          } catch (fetchError) {
            console.log('Fetch failed: ' + fetchError.message);
          }
        }
        break;
        
      case 'checkout':
        if (args[1] === '-b' && args[2]) {
          // Create and checkout new branch
          const newBranch = args[2];
          try {
            await git.branch({ fs, dir, ref: newBranch });
            await git.checkout({ fs, dir, ref: newBranch });
            console.log('Switched to a new branch \'' + newBranch + '\'');
          } catch (checkoutError) {
            console.log('Checkout failed: ' + checkoutError.message);
          }
        } else if (args[1]) {
          // Checkout existing branch
          const branchToCheckout = args[1];
          try {
            await git.checkout({ fs, dir, ref: branchToCheckout });
            console.log('Switched to branch \'' + branchToCheckout + '\'');
          } catch (checkoutError) {
            console.log('Checkout failed: ' + checkoutError.message);
          }
        } else {
          console.log('Usage: node mygit.cjs checkout <branch>');
          console.log('       node mygit.cjs checkout -b <new-branch>');
        }
        break;
        
      case 'branch':
        if (args.length === 1) {
          // List branches
          try {
            const branches = await git.listBranches({ fs, dir });
            const currentBranch = await git.currentBranch({ fs, dir }) || 'main';
            for (const branch of branches) {
              if (branch === currentBranch) {
                console.log('* ' + branch);
              } else {
                console.log('  ' + branch);
              }
            }
          } catch (error) {
            console.log('* main (no commits yet)');
          }
        } else if (args[1] === '-r' || args[1] === '--remote') {
          // List remote branches
          try {
            const remotes = await git.listRemotes({ fs, dir });
            for (const remote of remotes) {
              console.log('Fetching remote branches from ' + remote.remote + '...');
              try {
                const remoteBranches = await git.listBranches({ 
                  fs, 
                  dir, 
                  remote: remote.remote 
                });
                remoteBranches.forEach(branch => {
                  console.log('  remotes/' + remote.remote + '/' + branch);
                });
              } catch (fetchError) {
                console.log('  Could not fetch branches from ' + remote.remote);
              }
            }
          } catch (error) {
            console.log('No remote branches found');
          }
        } else {
          // Create new branch
          const newBranch = args[1];
          try {
            await git.branch({ fs, dir, ref: newBranch });
            console.log('Created branch ' + newBranch);
          } catch (branchError) {
            console.log('Branch creation failed: ' + branchError.message);
          }
        }
        break;
        
      case 'merge':
        if (!args[1]) {
          console.log('Usage: node mygit.cjs merge <branch>');
          console.log('       node mygit.cjs merge --abort');
          break;
        }
        
        if (args[1] === '--abort') {
          console.log('Merge abort is not fully supported in this implementation');
          console.log('You may need to manually resolve conflicts and commit');
          break;
        }
        
        const branchToMerge = args[1];
        try {
          console.log('Merging ' + branchToMerge + ' into current branch...');
          
          // Get current branch
          const currentBranch = await git.currentBranch({ fs, dir }) || 'main';
          
          // Perform the merge
          const result = await git.merge({
            fs,
            dir,
            ours: currentBranch,
            theirs: branchToMerge,
            author: {
              name: 'Bolt User',
              email: 'user@bolt.new'
            }
          });
          
          if (result.oid) {
            console.log('Merge successful!');
            console.log('Merge commit: ' + result.oid.substring(0, 7));
          } else {
            console.log('Already up to date.');
          }
        } catch (mergeError) {
          if (mergeError.code === 'MergeNotSupportedError') {
            console.log('Merge failed: This type of merge is not supported');
            console.log('You may need to resolve conflicts manually');
          } else {
            console.log('Merge failed: ' + mergeError.message);
          }
        }
        break;
        
      case 'rebase':
        if (!args[1]) {
          console.log('Usage: node mygit.cjs rebase <branch>');
          console.log('       node mygit.cjs rebase --abort');
          console.log('       node mygit.cjs rebase --continue');
          break;
        }
        
        if (args[1] === '--abort') {
          console.log('Rebase abort is not fully supported in this implementation');
          console.log('You may need to reset to the original state manually');
          break;
        }
        
        if (args[1] === '--continue') {
          console.log('Rebase continue is not fully supported in this implementation');
          console.log('Please resolve conflicts and commit manually');
          break;
        }
        
        const rebaseTarget = args[1];
        try {
          console.log('Rebasing current branch onto ' + rebaseTarget + '...');
          console.log('Note: Interactive rebase is not supported in this implementation');
          
          // Get current branch
          const currentBranch = await git.currentBranch({ fs, dir }) || 'main';
          
          if (currentBranch === rebaseTarget) {
            console.log('Already on target branch ' + rebaseTarget);
            break;
          }
          
          // Get commits to rebase
          const commits = await git.log({ fs, dir, ref: currentBranch });
          const targetCommits = await git.log({ fs, dir, ref: rebaseTarget });
          
          // Find common ancestor (simplified)
          const commonAncestor = targetCommits.find(tc => 
            commits.some(c => c.oid === tc.oid)
          );
          
          if (!commonAncestor) {
            console.log('No common ancestor found. Rebase may not work as expected.');
          }
          
          // Checkout target branch first
          await git.checkout({ fs, dir, ref: rebaseTarget });
          
          // Merge the changes (simplified rebase)
          await git.merge({
            fs,
            dir,
            ours: rebaseTarget,
            theirs: currentBranch,
            author: {
              name: 'Bolt User',
              email: 'user@bolt.new'
            }
          });
          
          // Switch back to original branch and fast-forward
          await git.checkout({ fs, dir, ref: currentBranch });
          await git.merge({
            fs,
            dir,
            ours: currentBranch,
            theirs: rebaseTarget,
            author: {
              name: 'Bolt User',
              email: 'user@bolt.new'
            }
          });
          
          console.log('Rebase completed (simplified merge-based rebase)');
          console.log('Note: This is a simplified rebase implementation');
          
        } catch (rebaseError) {
          console.log('Rebase failed: ' + rebaseError.message);
          console.log('You may need to resolve conflicts manually');
        }
        break;
        
      case 'reset':
        if (!args[1]) {
          console.log('Usage: node mygit.cjs reset --hard HEAD~1');
          console.log('       node mygit.cjs reset --soft HEAD~1');
          console.log('       node mygit.cjs reset HEAD <file>');
          break;
        }
        
        if (args[1] === '--hard' && args[2]) {
          try {
            const targetRef = args[2];
            console.log('Hard reset to ' + targetRef + '...');
            
            // Resolve the reference
            const oid = await git.resolveRef({ fs, dir, ref: targetRef });
            
            // Reset to the commit
            await git.checkout({ fs, dir, ref: oid, force: true });
            
            console.log('HEAD is now at ' + oid.substring(0, 7));
          } catch (resetError) {
            console.log('Reset failed: ' + resetError.message);
          }
        } else if (args[1] === '--soft' && args[2]) {
          console.log('Soft reset is not fully supported in this implementation');
          console.log('Use --hard for now, or manually manage staged changes');
        } else {
          console.log('Only --hard reset is supported in this implementation');
        }
        break;
        
      default:
        console.log('Simple Git Commands:');
        console.log('  node mygit.js init     - Initialize repository');
        console.log('  node mygit.js status   - Show status');
        console.log('  node mygit.js add .    - Add all files');
        console.log('  node mygit.js add file - Add specific file');
        console.log('  node mygit.js commit -m "message" - Commit changes');
        console.log('  node mygit.js log      - Show commit history');
    }
  } catch (error) {
    console.log('Error: ' + error.message);
  }
}

runGit();