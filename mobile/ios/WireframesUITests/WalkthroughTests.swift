import XCTest

/// Walks every control with the canned test model. RealModelTests covers the real one.
final class WalkthroughTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-wf-ui-test"]
        app.launch()
    }

    private var isTablet: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    private func element(_ id: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: id).firstMatch
    }

    /// A phone keeps both screens alive, so an id can match once on each. The tap goes to the one in view.
    private func tap(_ id: String, file: StaticString = #filePath, line: UInt = #line) {
        let query = app.descendants(matching: .any).matching(identifier: id)
        XCTAssertTrue(query.firstMatch.waitForExistence(timeout: 15), "\(id) is missing", file: file, line: line)
        // A control is reachable a moment after a slide settles, not during it.
        var target = query.allElementsBoundByIndex.first { $0.isHittable }
        let deadline = Date().addingTimeInterval(3)
        while target == nil && Date() < deadline {
            pause(0.25)
            target = query.allElementsBoundByIndex.first { $0.isHittable }
        }
        if let target {
            target.tap()
            return
        }
        // The hittable flag is unreliable in the phone's offset panes, while real touches
        // land. So touch the one on screen. Each step then checks the result of the touch.
        let screen = app.windows.firstMatch.frame
        let visible = query.allElementsBoundByIndex.first { screen.contains(CGPoint(x: $0.frame.midX, y: $0.frame.midY)) }
        XCTAssertNotNil(visible, "\(id) is not on screen, at \(query.allElementsBoundByIndex.map(\.frame))", file: file, line: line)
        visible?.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    private func shot(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func pause(_ seconds: TimeInterval = 0.8) {
        Thread.sleep(forTimeInterval: seconds)
    }

    private func send(_ text: String) {
        let field = element("composer.field")
        XCTAssertTrue(field.waitForExistence(timeout: 15))
        field.tap()
        // On a busy machine the first tap can land before the field is ready to focus.
        if !app.keyboards.firstMatch.waitForExistence(timeout: 3) {
            field.tap()
            XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "Tapping the message field should bring up the keyboard")
        }
        field.typeText(text)
        tap("composer.send")
    }

    private func pageShows(_ title: String) -> Bool {
        element("page.menu").waitForExistence(timeout: 10) && app.buttons["page.menu"].staticTexts[title].waitForExistence(timeout: 10)
    }

    private func choosePage(_ id: String) {
        tap("page.menu")
        tap("page.row.\(id)")
        pause()
    }

    private func walkPageTree() {
        tap("page.menu")
        XCTAssertTrue(element("page.row.overview").waitForExistence(timeout: 5), "The tree should list the pages")
        shot("page-tree")
        tap("page.add")
        let name = app.alerts.textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("Help centre")
        app.alerts.buttons["Add page"].firstMatch.tap()
        pause(1.5)
        tap("page.menu")
        XCTAssertTrue(element("page.row.help_centre").waitForExistence(timeout: 5), "A new page should join the tree")
        tap("page.delete.help_centre")
        let confirm = app.buttons["Delete page"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 5), "Deleting a page must ask first")
        confirm.tap()
        pause(1.5)
    }

    private func walkRendering() {
        tap("overflow.menu")
        let style = app.buttons["Page style"].firstMatch
        XCTAssertTrue(style.waitForExistence(timeout: 5))
        style.tap()
        tap("rendering.corners.square")
        tap("rendering.mode.line")
        pause()
        shot("rendering-square-lines")
        tap("rendering.corners.rounded")
        tap("rendering.mode.card")
        pause()
        tap("rendering.adapt")
        pause()
        shot("rendering-fixed")
        tap("rendering.adapt")
        pause()
        tap("rendering.done")
        pause()
    }

    private func walkSave() {
        tap("overflow.menu")
        let save = app.buttons["Save version"].firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 5))
        save.tap()
        let name = app.alerts.textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("First cut")
        app.alerts.buttons["Save"].firstMatch.tap()
        pause()
        // On a phone the version list is on the chat's live card.
        tap("preview.back")
        pause()
        tap("version.menu")
        let saved = app.buttons["First cut"].firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout: 5), "A saved version should be listed by name")
        saved.tap()
        pause()
        tap("chat.liveCard")
        XCTAssertTrue(element("viewer.phone").waitForExistence(timeout: 5))
        pause()
    }

    func testTablet() throws {
        try XCTSkipUnless(isTablet, "Tablet layout")

        // Every viewer size. Fill and Desktop have no orientation, so no rotate button.
        XCTAssertTrue(element("viewer.fill").waitForExistence(timeout: 30))
        XCTAssertTrue(element("page.webview").waitForExistence(timeout: 15))
        pause(2)
        shot("tablet-fill")
        XCTAssertFalse(element("viewer.rotate").exists, "Fill has no rotate button")
        tap("viewer.desktop")
        pause()
        shot("tablet-desktop")
        XCTAssertFalse(element("viewer.rotate").exists, "Desktop has no rotate button")
        for mode in ["phone", "tablet"] {
            tap("viewer.\(mode)")
            pause()
            shot("tablet-\(mode)")
            XCTAssertEqual(element("viewer.rotate").label, "Switch to landscape")
            tap("viewer.rotate")
            pause()
            shot("tablet-\(mode)-landscape")
            XCTAssertEqual(element("viewer.rotate").label, "Switch to portrait")
            tap("viewer.rotate")
            pause()
        }
        tap("viewer.fill")
        pause()

        // Hiding the chat gives the page everything, and the projects stay reachable.
        tap("tablet.hideChat")
        pause()
        XCTAssertFalse(element("composer.field").exists, "The chat should be hidden")
        shot("tablet-chat-hidden")
        tap("tablet.projectsHidden")
        XCTAssertTrue(element("projects.new").waitForExistence(timeout: 5), "Projects should open from the hidden state")
        tap("projects.done")
        pause()
        XCTAssertTrue(element("composer.field").waitForExistence(timeout: 5))

        // The page is live: its own links work.
        choosePage("overview")
        XCTAssertTrue(pageShows("Overview"))
        let link = app.webViews.staticTexts["Billing"].firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 10), "The page's own Billing link is missing")
        link.tap()
        pause(1.5)
        shot("tablet-link-followed")
        XCTAssertTrue(pageShows("Billing"), "Tapping a link in the page should change page")
        choosePage("billing")

        // A long press points at a component, without any mode.
        element("page.webview").coordinate(withNormalizedOffset: CGVector(dx: 0.7, dy: 0.36)).press(forDuration: 1.2)
        XCTAssertTrue(element("composer.selection").waitForExistence(timeout: 8), "A long press should select a component")
        shot("tablet-selected")
        tap("composer.clearSelection")
        pause()
        XCTAssertFalse(element("composer.selection").exists)

        walkPageTree()
        walkRendering()

        // An edit lands, shows a receipt, and can be undone and redone.
        send("Add a note")
        XCTAssertTrue(element("chat.undo").waitForExistence(timeout: 30), "An accepted edit should offer Undo")
        pause()
        shot("tablet-edited")
        tap("version.save")
        let name = app.alerts.textFields.firstMatch
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText("With a note")
        app.alerts.buttons["Save"].firstMatch.tap()
        pause()
        XCTAssertFalse(element("version.save").isEnabled, "A saved version has nothing left to save")
        shot("tablet-saved")
        tap("chat.undo")
        pause()
        tap("overflow.menu")
        let redo = app.buttons["Redo"].firstMatch
        XCTAssertTrue(redo.waitForExistence(timeout: 5))
        redo.tap()
        pause()
        tap("version.menu")
        let firstVersion = app.buttons["Version 1"].firstMatch
        XCTAssertTrue(firstVersion.waitForExistence(timeout: 5), "Version 1 should be listed")
        firstVersion.tap()
        pause()

        // A rejected edit changes nothing, says so and offers a retry.
        send("invalid change")
        XCTAssertTrue(element("chat.retry").waitForExistence(timeout: 30), "A rejected edit should offer a retry")
        shot("tablet-rejected")
        tap("chat.retry")
        pause(3)

        // A new page opens and joins the tree.
        send("Add a new page")
        XCTAssertTrue(pageShows("Settings"), "The new page should open")
        shot("tablet-new-page")
        choosePage("billing")

        tap("chat.new")
        pause()
        XCTAssertFalse(app.staticTexts["Add a new page"].exists, "A new chat should be empty")

        walkProjects(opener: "tablet.projects")
    }

    func testPhone() throws {
        try XCTSkipIf(isTablet, "Phone layout")

        XCTAssertTrue(element("pager.chat").waitForExistence(timeout: 30))
        pause(2)
        shot("phone-chat")
        send("Add a note")
        XCTAssertTrue(element("chat.undo").waitForExistence(timeout: 30))
        pause()
        shot("phone-chat-card")

        tap("chat.liveCard")
        XCTAssertTrue(element("viewer.phone").waitForExistence(timeout: 5), "The card should open the preview")
        pause(1.5)
        shot("phone-preview")
        // Proved by its effect: a real touch at the button must flip the orientation.
        let rotate = element("viewer.rotate")
        XCTAssertEqual(rotate.label, "Switch to landscape")
        func waitForRotateLabel(_ label: String) {
            let flipped = expectation(for: NSPredicate(format: "label == %@", label), evaluatedWith: rotate)
            wait(for: [flipped], timeout: 5)
        }
        rotate.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForRotateLabel("Switch to portrait")
        pause()
        shot("phone-landscape")
        rotate.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        waitForRotateLabel("Switch to landscape")
        pause()
        tap("viewer.desktop")
        pause()
        shot("phone-desktop")
        XCTAssertFalse(element("viewer.rotate").exists, "Desktop has no rotate button")
        tap("viewer.phone")
        pause()

        walkPageTree()
        walkRendering()
        walkSave()

        // Interactive off: a tap selects and the page does not react.
        element("page.webview").coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)).tap()
        XCTAssertTrue(element("composer.selection").waitForExistence(timeout: 5), "A tap should select a component")
        shot("phone-selected")
        tap("composer.clearSelection")

        // Interactive on: there is always a way back out.
        tap("viewer.interactive")
        pause()
        shot("phone-interactive")
        tap("viewer.interactive")
        pause()

        tap("preview.back")
        XCTAssertTrue(element("pager.chat").waitForExistence(timeout: 5))
        tap("pager.preview")
        pause()
        tap("preview.back")
        pause()
        tap("chat.new")

        walkProjects(opener: "chat.projects")
    }

    private func walkProjects(opener: String) {
        tap(opener)
        XCTAssertTrue(element("projects.new").waitForExistence(timeout: 5))
        tap("projects.expand")
        XCTAssertTrue(element("page.row.billing").waitForExistence(timeout: 5), "A project should open to its pages")
        shot("projects")
        tap("page.row.team")
        pause(1.5)
        XCTAssertTrue(pageShows("Team") || !isTablet, "Choosing a page in the browser should open it")

        tap(opener)
        tap("projects.new")
        pause(1.5)
        tap(opener)
        XCTAssertTrue(element("projects.rename").waitForExistence(timeout: 5))
        tap("projects.rename")
        let field = app.alerts.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        field.typeText(" renamed")
        app.alerts.buttons["Rename"].firstMatch.tap()
        pause()
        XCTAssertTrue(app.staticTexts["Untitled renamed"].firstMatch.waitForExistence(timeout: 5) || app.staticTexts["Acme Admin renamed"].firstMatch.exists)
        shot("projects-renamed")
        // A dialog cannot open until the rename alert has finished closing.
        pause(2)

        tap("projects.delete")
        let confirm = app.buttons["Delete project"].firstMatch
        XCTAssertTrue(confirm.waitForExistence(timeout: 5), "Deleting must ask first")
        confirm.tap()
        pause(1.5)
        tap("projects.done")
        pause()
        shot("after-projects")
    }
}

/// With no model on the device, the chat has to offer one.
final class ModelBannerTests: XCTestCase {
    func testBannerIsInTheChat() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-wf-ui-test", "-wf-no-model"]
        app.launch()
        let banner = app.descendants(matching: .any).matching(identifier: "model.banner").firstMatch
        let field = app.descendants(matching: .any).matching(identifier: "composer.field").firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 30))
        // A device that already has the model rightly offers nothing. RealModelTests covers it.
        if field.placeholderValue == "Describe a change" { throw XCTSkip("The model is already installed here") }
        XCTAssertTrue(banner.waitForExistence(timeout: 30), "The chat should offer the model")
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "model-banner"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}

/// The real thing: downloads the model if needed and designs with it on this device.
final class RealModelTests: XCTestCase {
    func testDesignWithTheRealModel() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-wf-real-model"]
        app.launch()

        func element(_ id: String) -> XCUIElement { app.descendants(matching: .any).matching(identifier: id).firstMatch }
        func report(_ name: String) {
            let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            attachment.name = name
            attachment.lifetime = .keepAlways
            add(attachment)
            print("WF-METRIC \(name): \(element("debug.metrics").exists ? element("debug.metrics").label : "")")
        }

        let download = element("model.download")
        if download.waitForExistence(timeout: 20) {
            download.tap()
        }
        // 3.35 GB over Wi-Fi, then the digest check.
        let field = element("composer.field")
        let deadline = Date().addingTimeInterval(45 * 60)
        while element("model.banner").exists && Date() < deadline {
            Thread.sleep(forTimeInterval: 15)
        }
        XCTAssertFalse(element("model.banner").exists, "The model should have installed")
        report("real-installed")

        let requests = [
            "Design a landing page for a dog walking app: a headline, a short pitch, a sign up button and three feature cards.",
            "Add a pricing page with three plans, and link to it from a button on this page.",
            "Add a table of upcoming walks with date, dog and walker columns.",
        ]
        for (index, request) in requests.enumerated() {
            XCTAssertTrue(field.waitForExistence(timeout: 30))
            field.tap()
            field.typeText(request)
            element("composer.send").tap()
            Thread.sleep(forTimeInterval: 2)
            let waitUntil = Date().addingTimeInterval(10 * 60)
            while element("work.status").exists && Date() < waitUntil {
                Thread.sleep(forTimeInterval: 2)
            }
            XCTAssertFalse(element("work.status").exists, "Generation should finish")
            report("real-\(index + 1)")
            XCTAssertTrue(element("chat.undo").waitForExistence(timeout: 5), "The edit should have landed: \(request)")
        }
    }
}
