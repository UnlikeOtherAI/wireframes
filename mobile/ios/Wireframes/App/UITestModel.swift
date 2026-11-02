#if DEBUG
import Foundation

/// Canned answers, so a UI test can walk every control without a 3 GB download.
/// It only runs with -wf-ui-test, only in debug builds, and proves nothing about the model.
enum UITestModel {
    static func answer(for request: String) async -> String? {
        try? await Task.sleep(for: .milliseconds(400))
        if request.contains("invalid") { return "changes:\n  - op: remove\n    node: not_a_node" }
        if request.contains("new page") {
            return """
            changes:
              - op: addPage
                id: settings
                title: Settings
                content:
                  - id: settings_title
                    component: heading
                    props: { text: Settings, level: 1 }
            """
        }
        return """
        changes:
          - op: insertAfter
            node: header
            value:
              id: ui_test_note
              component: alert
              props: { title: UI test change, text: This came from the canned test model., variant: info }
        """
    }
}
#endif
