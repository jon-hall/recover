## recover
An ultra-simple folder versioning API built on git.

```sh
npm install recover
```

### Example
```js
const recover = require('recover'),
    recoverer = recover(),
    fsp = require('fs-promise');

// The first push inits a git repo and commits all files in target
recoverer.push('init')
    .then(_ => fsp.writeFile('a.txt', 'a'))

    // Push some new versions with file changes
    .then(_ => recoverer.push('add a'))
    .then(_ => fsp.writeFile('b.txt', 'b'))
    .then(_ => recoverer.push('add b'))

    // Navigate to a specific version
    .then(_ => recoverer.to('add a'))
    .then(
        _ => fsp.readFile('b.txt'),
        // Suppress any rejections so far
        err => Promise.resolve(1)
    )
    .then(
        _ => console.log('not hit'),
        // 'b.txt' no longer exists, so we get a rejection
        err => console.log('recovered version "add a"')
    )
    // Don't worry, we can still go back to b!
    .then(_ => recoverer.to('add b'))
    .then(
        _ => fsp.readFile('b.txt'),
        err => Promise.resolve(1)
    )
    .then(
        // 'b.txt' now longer exists, so we resolve instead
        _ => console.log('recovered version "add b"')
        err => console.log('not hit'),
    )
    // Well, we can go back until we do this...
    .then(_ => recoverer.pop())
    .then(
        _ => fsp.readFile('b.txt'),
        err => Promise.resolve(1)
    )
    .then(
        _ => console.log('not hit'),
        err => console.log('popped to version "add a"')
    )
    .then(_ => recoverer.to('add b'))
    .then(
        _ => fsp.readFile('b.txt'),
        err => Promise.resolve(1)
    )
    .then(
        // The pop destroyed the "add b" version
        _ => console.log('not hit'),
        err => console.log('can\'t recover version "add b"')
    )

```

### API
All of the methods (other than the constructor) return Promises, which resolve with the result once the operation is complete.

- [recover](#recoveroptions)
- [Recover](#new-Recoveroptions)
    - [Recover.prototype.push](#recoverprototypepushlabel)
    - [Recover.prototype.pop](#recoverprototypepop)
    - [Recover.prototype.to](#recoverprototypetolabel)
    - [Recover.prototype.reset](#recoverprototypereset)

##### recover([options])
Factory method for creating a new Recover instance.

```js
const recover = require('recover'),
    recoverer = recover();
```
Takes the same options as the [constructor](#new-Recoveroptions).

##### new Recover([options])
Constructor for creating a new Recover instance.

 ```js
 const Recover = require('recover').Recover,
     recoverer = new Recover();
 ```
  - `[options]`
    - `target` (String) - the directory to version *(default: `process.cwd()`)*.
    - `gitdir` (String) - the directory to use as the `.git` folder *(default: `"%USER_DATA_DIR%/recover/<target_path_hash>/.git"`)*.

##### Recover.prototype.push([label])
Pushes the current state of the `target` folder as a new, labelled, version.

> Warning: If `push` is called when the folder is not on the latest version (e.g. `to` has been used), then all "future" versions will be discarded

```js
// It resolves with the label passed in,
// or the one it generated if none was
recoverer.push()
    .then(
        label => console.log(label),
        err => console.error(err)
    );
```
The `label` is a unique string you can later use with [Recover.prototype.to](#recoverprototypetolabel).

##### Recover.prototype.pop()
Pops the last version of the `target` folder, discarding changes between the current and last version, this also destroy any un-`push`ed changes.

> Warning: If `pop` is called when the folder is not on the latest version (e.g. `to` has been used), then all "future" versions will be discarded

```js
recoverer.pop()
    .then(
        _ => console.log('popped!'),
        err => console.error(err)
    );
```

##### Recover.prototype.to(label)
Allows bi-directional traversal of the version history by checking-out the `target` folder at the specified version.

> Warning: If `push` or `pop` is called when the folder is not on the latest version, all "future" versions will be discarded

```js
let label1;
recoverer.push()
    .then(
        label => {
            label1 = label;
            return recoverer.push();
        }
    )
    .then(
        label => {
            return recoverer.to(label1);
        }
    ).then(
        _ => console.log(`Now at version "${label1}"`),
        err => console.error(err)
    );

```
Throws if no label supplied, or if the label isn't a valid version for the `target` folder.

##### Recover.prototype.reset()
Destroys any un-`push`ed changes in the `target` folder.

> Note: If `reset` is called when the folder is not on the latest version (e.g. `to` has been used), all "future" versions are **preserved**, only current changes are destroyed

```js
recoverer.reset()
    .then(
        _ => console.log('reset!'),
        err => console.error(err)
    );
```
