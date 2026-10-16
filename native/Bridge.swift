import AppKit
import ApplicationServices
import CryptoKit

func output(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value), let text = String(data: data, encoding: .utf8) { print(text) }
}
func attribute(_ element: AXUIElement, _ name: CFString) -> CFTypeRef? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(element, name, &value) == .success else { return nil }
    return value
}
func settable(_ element: AXUIElement, _ name: CFString) -> Bool {
    var value = DarwinBoolean(false)
    return AXUIElementIsAttributeSettable(element, name, &value) == .success && value.boolValue
}
func textHash(_ text: String) -> String {
    let normalized = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    return SHA256.hash(data: Data(normalized.utf8)).map { String(format: "%02x", $0) }.joined()
}
func stableDescription(_ value: CFTypeRef) -> String {
    if CFGetTypeID(value) == AXValueGetTypeID() {
        let ax = value as! AXValue
        switch AXValueGetType(ax) {
        case .cgPoint:
            var point = CGPoint.zero
            if AXValueGetValue(ax, .cgPoint, &point) { return "point:\(point.x),\(point.y)" }
        case .cgSize:
            var size = CGSize.zero
            if AXValueGetValue(ax, .cgSize, &size) { return "size:\(size.width),\(size.height)" }
        case .cfRange:
            var range = CFRange(location: 0, length: 0)
            if AXValueGetValue(ax, .cfRange, &range) { return "range:\(range.location),\(range.length)" }
        case .cgRect:
            var rect = CGRect.zero
            if AXValueGetValue(ax, .cgRect, &rect) { return "rect:\(rect.origin.x),\(rect.origin.y),\(rect.width),\(rect.height)" }
        default: break
        }
        return "unsupported-ax-value"
    }
    if let text = value as? String { return text }
    if let number = value as? NSNumber { return number.stringValue }
    return ""
}
// Web content may expose a focused element owned by a renderer process.
// Validate the focused application, rather than equating the field PID with its host PID.
func focusedElement(_ application: AXUIElement, pid: pid_t) -> AXUIElement? {
    if let value = attribute(application, kAXFocusedUIElementAttribute as CFString), CFGetTypeID(value) == AXUIElementGetTypeID() {
        return (value as! AXUIElement)
    }
    let system = AXUIElementCreateSystemWide()
    guard let owner = attribute(system, kAXFocusedApplicationAttribute as CFString), CFGetTypeID(owner) == AXUIElementGetTypeID() else { return nil }
    var ownerPID: pid_t = 0
    guard AXUIElementGetPid(owner as! AXUIElement, &ownerPID) == .success, ownerPID == pid,
          let value = attribute(system, kAXFocusedUIElementAttribute as CFString), CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
    return (value as! AXUIElement)
}
func context() -> [String: Any] {
    guard let app = NSWorkspace.shared.frontmostApplication else { return ["pid": 0, "name": "", "fingerprint": ""] }
    var result: [String: Any] = ["pid": app.processIdentifier, "name": app.localizedName ?? "", "bundleId": app.bundleIdentifier ?? "", "selectedText": "", "fingerprint": "", "status": "permission-denied"]
    guard AXIsProcessTrusted() else { return result }
    let application = AXUIElementCreateApplication(app.processIdentifier)
    result["status"] = "focus-unavailable"
    guard let field = focusedElement(application, pid: app.processIdentifier) else { return result }
    let subrole = attribute(field, kAXSubroleAttribute as CFString) as? String ?? ""
    guard !subrole.lowercased().contains("secure") else { result["status"] = "secure-field"; return result }
    result["selectedText"] = String((attribute(field, kAXSelectedTextAttribute as CFString) as? String ?? "").prefix(12000))
    let names = [kAXRoleAttribute, kAXSubroleAttribute, kAXIdentifierAttribute, kAXTitleAttribute, kAXPositionAttribute, kAXSizeAttribute, kAXValueAttribute, kAXSelectedTextRangeAttribute]
    var parts = names.map { name in attribute(field, name as CFString).map { stableDescription($0) } ?? "" }
    var windowTitle = ""
    if let windowValue = attribute(application, kAXFocusedWindowAttribute as CFString), CFGetTypeID(windowValue) == AXUIElementGetTypeID() {
        let window = windowValue as! AXUIElement
        windowTitle = attribute(window, kAXTitleAttribute as CFString) as? String ?? ""
        parts.append(windowTitle)
    }
    parts.append(String(app.processIdentifier))
    let fingerprint = SHA256.hash(data: Data(parts.joined(separator: "\u{001f}").utf8)).map { String(format: "%02x", $0) }.joined()
    let identityNames = [kAXRoleAttribute, kAXSubroleAttribute, kAXIdentifierAttribute, kAXTitleAttribute, kAXPositionAttribute, kAXSizeAttribute]
    var identityParts = identityNames.map { name in attribute(field, name as CFString).map { stableDescription($0) } ?? "" }
    identityParts.append(windowTitle)
    identityParts.append(String(app.processIdentifier))
    result["fieldIdentity"] = SHA256.hash(data: Data(identityParts.joined(separator: "\u{001f}").utf8)).map { String(format: "%02x", $0) }.joined()
    let role = attribute(field, kAXRoleAttribute as CFString) as? String ?? ""
    let editable = ["AXTextArea", "AXTextField", "AXComboBox"].contains(role)
    result["editable"] = editable
    result["status"] = editable ? "ready" : "not-editable"
    guard editable else { return result }
    if editable, let draft = attribute(field, kAXValueAttribute as CFString) as? String {
        let normalized = draft.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalized.isEmpty { result["draftHash"] = SHA256.hash(data: Data(normalized.utf8)).map { String(format: "%02x", $0) }.joined() }
    }
    if let rangeValue = attribute(field, kAXSelectedTextRangeAttribute as CFString), CFGetTypeID(rangeValue) == AXValueGetTypeID() {
        var range = CFRange(location: 0, length: 0)
        if AXValueGetValue(rangeValue as! AXValue, .cfRange, &range), range.location >= 0, range.length >= 0 {
            result["selectionStart"] = range.location
            result["selectionLength"] = range.length
            result["liveEditable"] = settable(field, kAXSelectedTextRangeAttribute as CFString) && attribute(field, kAXValueAttribute as CFString) is String
        }
    }
    result["fingerprint"] = fingerprint
    return result
}
let command = CommandLine.arguments.dropFirst().first ?? "context"
if command == "context" {
    output(context())
} else if command == "replaceDraft", CommandLine.arguments.count == 6,
          let pid = Int32(CommandLine.arguments[2]), let start = Int(CommandLine.arguments[4]), let length = Int(CommandLine.arguments[5]) {
    let bytes = FileHandle.standardInput.readDataToEndOfFile()
    guard bytes.count <= 400000, let text = String(data: bytes, encoding: .utf8), AXIsProcessTrusted() else {
        output(["ok": false, "message": "实时填入权限或文字格式不可用"]); exit(0)
    }
    let current = context()
    guard current["pid"] as? Int32 == pid, current["fingerprint"] as? String == CommandLine.arguments[3],
          current["liveEditable"] as? Bool == true,
          let field = focusedElement(AXUIElementCreateApplication(pid), pid: pid),
          let draft = attribute(field, kAXValueAttribute as CFString) as? String else {
        output(["ok": false, "message": "输入位置或内容已改变，实时填入已暂停"]); exit(0)
    }
    let source = draft as NSString
    guard start >= 0, length >= 0, start <= source.length, length <= source.length - start else {
        output(["ok": false, "message": "实时草稿范围已失效"]); exit(0)
    }
    let expected = source.replacingCharacters(in: NSRange(location: start, length: length), with: text)
    var range = CFRange(location: start, length: length)
    guard let selection = AXValueCreate(.cfRange, &range),
          AXUIElementSetAttributeValue(field, kAXSelectedTextRangeAttribute as CFString, selection) == .success else {
        output(["ok": false, "message": "目标软件不支持选择草稿范围，实时填入已暂停"]); exit(0)
    }
    if settable(field, kAXSelectedTextAttribute as CFString) {
        guard AXUIElementSetAttributeValue(field, kAXSelectedTextAttribute as CFString, text as CFString) == .success else {
            output(["ok": false, "message": "目标软件拒绝更新草稿，实时填入已暂停"]); exit(0)
        }
        var caret = CFRange(location: start + (text as NSString).length, length: 0)
        if let caretValue = AXValueCreate(.cfRange, &caret) {
            _ = AXUIElementSetAttributeValue(field, kAXSelectedTextRangeAttribute as CFString, caretValue)
        }
    } else {
        // Some editors expose a writable selection but not writable selected text.
        // Paste replaces only that guarded selection; never select-all/backspace.
        let selected = context()
        guard selected["pid"] as? Int32 == pid,
              selected["fieldIdentity"] as? String == current["fieldIdentity"] as? String,
              selected["selectionStart"] as? Int == start, selected["selectionLength"] as? Int == length,
              selected["draftHash"] as? String == current["draftHash"] as? String,
              let down = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: false) else {
            output(["ok": false, "message": "输入位置已变化，实时填入已暂停"]); exit(0)
        }
        NSPasteboard.general.clearContents()
        guard NSPasteboard.general.setString(text, forType: .string) else {
            output(["ok": false, "message": "无法准备实时草稿"]); exit(0)
        }
        down.flags = .maskCommand; up.flags = .maskCommand
        down.post(tap: .cghidEventTap); up.post(tap: .cghidEventTap)
    }
    output(["ok": true, "expectedDraftHash": textHash(expected)])
} else if command == "paste", CommandLine.arguments.count == 4, let pid = Int32(CommandLine.arguments[2]) {
    guard AXIsProcessTrusted() else { output(["ok": false, "message": "请在系统设置中允许 Voxa 使用辅助功能，然后重试。"]); exit(0) }
    let current = context()
    guard current["pid"] as? Int32 == pid, let fingerprint = current["fingerprint"] as? String, !fingerprint.isEmpty, fingerprint == CommandLine.arguments[3] else { output(["ok": false, "message": "输入位置或文字已经变化，结果保留在 Voxa，请手动复制。"]); exit(0) }
    // Compute the expected full value before posting Paste, including any existing draft.
    var expectedHash: String? = nil
    let appElement = AXUIElementCreateApplication(pid)
    if let field = focusedElement(appElement, pid: pid) {
        if let draft = attribute(field, kAXValueAttribute as CFString) as? String,
           let pastedText = NSPasteboard.general.string(forType: .string),
           let rangeValue = attribute(field, kAXSelectedTextRangeAttribute as CFString), CFGetTypeID(rangeValue) == AXValueGetTypeID() {
            var range = CFRange(location: 0, length: 0)
            let source = draft as NSString
            if AXValueGetValue(rangeValue as! AXValue, .cfRange, &range), range.location >= 0, range.length >= 0,
               range.location <= source.length, range.length <= source.length - range.location {
                let expected = source.replacingCharacters(in: NSRange(location: range.location, length: range.length), with: pastedText)
                    .replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
                expectedHash = SHA256.hash(data: Data(expected.utf8)).map { String(format: "%02x", $0) }.joined()
            }
        }
    }
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: true), let up = CGEvent(keyboardEventSource: nil, virtualKey: 9, keyDown: false) else { output(["ok": false, "message": "无法创建粘贴事件"]); exit(0) }
    down.flags = .maskCommand; up.flags = .maskCommand
    down.post(tap: .cghidEventTap); up.post(tap: .cghidEventTap)
    var response: [String: Any] = ["ok": true]
    if let hash = expectedHash { response["expectedDraftHash"] = hash }
    output(response)
} else if command == "enter", CommandLine.arguments.count == 5, let pid = Int32(CommandLine.arguments[2]) {
    guard AXIsProcessTrusted() else { output(["ok": false, "message": "辅助功能权限不可用，没有按回车。"]); exit(0) }
    let current = context()
    guard current["pid"] as? Int32 == pid,
          current["editable"] as? Bool == true,
          let identity = current["fieldIdentity"] as? String, !identity.isEmpty, identity == CommandLine.arguments[3],
          let hash = current["draftHash"] as? String, !hash.isEmpty, hash == CommandLine.arguments[4] else {
        output(["ok": false, "message": "输入位置或内容已变化，没有按回车。"]); exit(0)
    }
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 36, keyDown: true), let up = CGEvent(keyboardEventSource: nil, virtualKey: 36, keyDown: false) else {
        output(["ok": false, "message": "无法创建回车事件"]); exit(0)
    }
    down.flags = []; up.flags = []
    down.post(tap: .cghidEventTap); up.post(tap: .cghidEventTap)
    output(["ok": true])
} else if command == "requestPermission" {
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    output(["accessibility": AXIsProcessTrustedWithOptions(options)])
} else if command == "permission" {
    output(["accessibility": AXIsProcessTrusted()])
} else { output(["ok": false, "message": "未知操作"]); exit(1) }
