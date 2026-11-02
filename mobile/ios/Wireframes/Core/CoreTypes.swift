import SwiftUI

struct ProjectSummary: Codable, Identifiable, Equatable {
    let id: Int64
    let name: String
    let updated: Int64
    let revisions: Int64
}

struct ProjectState: Codable, Equatable {
    let id: Int64
    let name: String
    let revision: Int64
    let chat: Int64
    let wf: String
    let page: String
    let canUndo: Bool
    let canRedo: Bool
    let saved: Bool
}

struct ChatMessage: Codable, Identifiable, Equatable {
    let id: Int64
    let role: String
    let text: String
    let revision: Int64

    var isUser: Bool { role == "user" }
}

struct DesignVersion: Codable, Identifiable, Equatable {
    let id: Int64
    let summary: String
    let number: Int64
    let label: String
}

struct ModelFile: Codable, Equatable {
    let id: String
    let fileName: String
    let sha256: String
    let bytes: UInt64
    let urls: [String]
}

struct ModelChoice: Codable, Equatable {
    let status: String
    let model: String
    let requiredBytes: UInt64
}

struct PageInfo: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let route: String?
    let path: String
}

struct Selection: Codable, Equatable {
    let id: String
    let source: String
    let definition: String?
    let row: Int?
    let label: String
    let shared: Bool
}

struct EditDiagnostic: Codable, Equatable {
    let code: String
    let message: String
}

struct EditResult: Codable, Equatable {
    let ok: Bool
    let wf: String?
    let page: String?
    let changes: [String]?
    let diagnostics: [EditDiagnostic]
}

struct ModelContext: Codable, Equatable {
    let pages: String
    let outline: String
    let selected: String
    let shared: Bool
}

struct GenerationResult: Codable {
    let ok: Bool
    let text: String?
    let finish: String?
    let promptTokens: Int?
    let tokens: Int?
    let firstTokenMs: Int64?
    let totalMs: Int64?
    let error: String?
}

struct LoadResult: Codable {
    let ok: Bool
    let gpuLayers: Int?
    let loadMs: Int64?
    let error: String?
}

struct BuiltPrompt: Codable {
    let prompt: String?
    let tokens: Int?
    let droppedTurns: Int?
    let error: String?
}

/// What the page is laid out as. Device sizes are fixed; Fill follows the area it sits in.
enum ViewerMode: String, CaseIterable, Identifiable {
    case fill, phone, tablet, desktop

    var id: String { rawValue }

    var title: LocalizedStringKey {
        switch self {
        case .fill: return "Fill"
        case .phone: return "Phone"
        case .tablet: return "Tablet"
        case .desktop: return "Desktop"
        }
    }
}
