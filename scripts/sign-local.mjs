import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bundle=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'release/mac-arm64/Voxa.app');
for(const name of ['whisper-server','llama-server'])execFileSync('/usr/bin/codesign',['--force','--sign','-',path.join(bundle,'Contents/Resources/runtime',name)],{stdio:'inherit'});
// Local ad-hoc signing seals the packaged resources. This is not Developer ID notarization.
execFileSync('/usr/bin/codesign',['--force','--sign','-','--identifier','local.voiceleaf.bridge',path.join(bundle,'Contents/Resources/voiceleaf-bridge')],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',['--force','--deep','--sign','-','--identifier','local.voiceleaf.desktop',bundle],{stdio:'inherit'});
execFileSync('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',bundle],{stdio:'inherit'});
