import Foundation
import WfCore

struct PromptFields {
    var elements: String
    var context: ModelContext
    var request: String
    var failedOutput: String?
    var diagnostics: String?
    var beforeMessage: Int64
    var chat: Int64
    var project: Int64
}

enum CorePrompt {
    /// The answer needs room too, so input stops short of the whole context.
    static let inputLimit = CoreEngine.contextTokens - CoreEngine.maxOutputTokens - 64

    static func build(store: CoreStore, engine: CoreEngine, fields: PromptFields) -> BuiltPrompt {
        let strings = [
            fields.elements, fields.context.pages, fields.context.outline, fields.context.selected,
            fields.request, fields.failedOutput ?? "", fields.diagnostics ?? "",
        ].map { strdup($0) }
        defer { strings.forEach { free($0) } }

        var input = wf_prompt_input()
        input.system = wf_system_prompt()
        input.elements = UnsafePointer(strings[0])
        input.pages = UnsafePointer(strings[1])
        input.outline = UnsafePointer(strings[2])
        input.selected = UnsafePointer(strings[3])
        input.selected_is_shared = fields.context.shared
        input.request = UnsafePointer(strings[4])
        input.failed_output = UnsafePointer(strings[5])
        input.diagnostics = UnsafePointer(strings[6])
        input.before_message = fields.beforeMessage
        input.chat = fields.chat
        input.project = fields.project
        input.input_token_limit = inputLimit

        let built: BuiltPrompt? = CoreJSON.decode(wf_prompt_build(store.raw, engine.handle, &input))
        return built ?? BuiltPrompt(prompt: nil, tokens: nil, droppedTurns: nil, error: "PROMPT_FAILED")
    }

    static func catalog() -> [ModelFile] {
        let mirror = Bundle.main.object(forInfoDictionaryKey: "WFModelMirrorURL") as? String
        return CoreJSON.decode(wf_catalog_json(mirror)) ?? []
    }

    static func choose(ram: Double, freeDisk: UInt64, thermal: Int32, e4bQualified: Bool, failed: String?) -> ModelChoice? {
        CoreJSON.decode(wf_select_model(ram, freeDisk, thermal, e4bQualified, failed))
    }
}
