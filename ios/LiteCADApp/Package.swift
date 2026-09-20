// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "LiteCADApp",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(name: "LiteCADApp", targets: ["LiteCADApp"])
    ],
    dependencies: [
        .package(path: "../LiteCADCore")
    ],
    targets: [
        .target(
            name: "LiteCADApp",
            dependencies: [
                .product(name: "LiteCADCore", package: "LiteCADCore")
            ]
        )
    ]
)
