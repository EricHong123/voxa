import AppKit
let size = NSSize(width: 1024, height: 1024)
let image = NSImage(size: size)
image.lockFocus()
NSColor(calibratedRed: 0.12, green: 0.12, blue: 0.13, alpha: 1).setFill()
NSBezierPath(roundedRect: NSRect(x: 50,y: 50,width: 924,height: 924), xRadius: 218,yRadius: 218).fill()
NSColor(calibratedRed: 0.98,green: 0.98,blue: 0.98,alpha: 1).setStroke()
for (i, height) in [170.0,310,460,590,410,270,130].enumerated() {
 let x = 272.0 + Double(i) * 80
 let line = NSBezierPath();line.lineWidth = 30;line.lineCapStyle = .round
 line.move(to:NSPoint(x:x,y:512-height/2));line.line(to:NSPoint(x:x,y:512+height/2));line.stroke()
}
image.unlockFocus()
let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:CommandLine.arguments[1]))
