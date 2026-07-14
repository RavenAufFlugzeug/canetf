A workflow many Fedora Atomic/Bazzite developers use is:

Open VS Code normally from your desktop or by running code . on the host.
Use VS Code's integrated terminal.
In that terminal, enter the toolbox:
toolbox enter canetf-dev

Then run:

npm run dev

This keeps VS Code on the host while all your development tools (Node.js, npm, Python, etc.) live in the toolbox. It's simple, reliable, and avoids having to duplicate editor installations.
