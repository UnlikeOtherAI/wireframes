# Company skin example

This two-page iPad wireframe stores Acme Blue and Forest skins in its manifest. It includes primary/secondary/danger actions, a nested form, a shared action style, a status cue and navigation.

Unpack and build it with the current engine:

    wf unpack acme.wf --out ./project
    cd project
    wf validate
    wf build --platform tablet

Change manifest.designSystem.activeSkin to forest to switch all pages, or wireframe to restore the legacy appearance. The 1.2 manifest remains required while named skins are saved. The .wf container and other documents remain unchanged.

The skin editor is supplied by the host app; this example also works through the pure getDesignSystem/updateDesignSystem API described in docs/cli/design-system.md.
