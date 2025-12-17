// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "ios-helper",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "ios-helper", targets: ["ios-helper"])
    ],
    targets: [
        .executableTarget(
            name: "ios-helper",
            dependencies: [],
            linkerSettings: [
                .linkedFramework("AVFoundation"),
                .linkedFramework("CoreMediaIO"),
                .linkedFramework("CoreMedia"),
                .linkedFramework("CoreVideo")
            ]
        )
    ]
)
