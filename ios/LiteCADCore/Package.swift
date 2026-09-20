// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "LiteCADCore",
    products: [
        .library(name: "LiteCADCore", targets: ["LiteCADCore"])
    ],
    targets: [
        .target(name: "LiteCADCore"),
        .testTarget(name: "LiteCADCoreTests", dependencies: ["LiteCADCore"])
    ]
)
