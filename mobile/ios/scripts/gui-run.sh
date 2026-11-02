#!/bin/zsh
# Runs a command in the logged-in desktop session and waits for it. Code signing over
# SSH fails with errSecInternalComponent, because only that session has the keychain.
# usage: gui-run.sh <log-file> <command> [args...]
set -u

log="$1"
shift
label="com.unlikeotherai.wireframes.guirun.$$"
plist="/tmp/${label}.plist"
marker="/tmp/${label}.exit"
script="/tmp/${label}.sh"

{
  echo '#!/bin/zsh -l'
  echo "cd ${(q)PWD}"
  print -r -- "${(q)@} > ${(q)log} 2>&1"
  echo "echo \$? > ${(q)marker}"
} > "${script}"
chmod +x "${script}"

cat > "${plist}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${script}</string></array>
  <key>RunAtLoad</key><true/>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
</dict></plist>
EOF

launchctl bootstrap "gui/$(id -u)" "${plist}" || exit 3
while [[ ! -f "${marker}" ]]; do sleep 2; done
code="$(cat "${marker}")"
launchctl bootout "gui/$(id -u)/${label}" 2>/dev/null
rm -f "${plist}" "${marker}" "${script}"
exit "${code}"
