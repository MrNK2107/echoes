import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var audioPlayer: AVPlayer?
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    guard let registrar = engineBridge.pluginRegistry.registrar(
      forPlugin: "EchoesAudioPlugin"
    ) else {
      return
    }
    let channel = FlutterMethodChannel(
      name: "echoes/audio",
      binaryMessenger: registrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      switch call.method {
      case "play":
        guard
          let arguments = call.arguments as? [String: Any],
          let rawUrl = arguments["url"] as? String,
          let url = URL(string: rawUrl)
        else {
          result(FlutterError(code: "invalid_url", message: "Audio URL is required", details: nil))
          return
        }
        self?.audioPlayer = AVPlayer(url: url)
        self?.audioPlayer?.play()
        result(nil)
      case "pause":
        self?.audioPlayer?.pause()
        result(nil)
      case "stop":
        self?.audioPlayer?.pause()
        self?.audioPlayer = nil
        result(nil)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
  }
}
