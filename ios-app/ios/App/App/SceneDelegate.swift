import UIKit
import Capacitor
import AuthenticationServices

// 마이복서153 아이폰 앱 — myboxer153.com 을 담는 화면 + 앱 전용 기능 2개.
// 이 파일 하나에 모아 둔다 (Xcode 프로젝트 파일을 손으로 고치지 않으려고).
//   · WebAuth    : 구글·카카오 로그인을 '안전한 로그인 창'(ASWebAuthenticationSession)으로 연다.
//                  구글은 앱 속 웹 화면(WKWebView)에서 로그인을 막기 때문에 꼭 필요하다.
//   · AppleSignIn: 애플로 로그인 (App Store 심사 4.8 — 카카오·구글 로그인이 있으면 애플 로그인도 있어야 한다)

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// 앱 화면 — 기본 Capacitor 화면에 앱 전용 기능을 붙인다.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WebAuthPlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // 화면 왼쪽 끝에서 밀면 이전 화면으로 (아이폰 기본 뒤로 가기 동작)
        webView?.allowsBackForwardNavigationGestures = true
    }
}

/// 구글·카카오 로그인 창. 로그인이 끝나 myboxer153:// 주소로 돌아오면 그 주소를 웹에 넘긴다.
@objc(WebAuthPlugin)
public class WebAuthPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "WebAuthPlugin"
    public let jsName = "WebAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise)
    ]

    private var session: ASWebAuthenticationSession?

    @objc func start(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https" else {
            call.reject("주소가 올바르지 않습니다", "BAD_URL")
            return
        }
        let scheme = call.getString("callbackScheme") ?? "myboxer153"
        let ephemeral = call.getBool("ephemeral") ?? false

        DispatchQueue.main.async {
            if let old = self.session {
                old.cancel()
                self.session = nil
            }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: scheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let callbackURL = callbackURL {
                    call.resolve(["url": callbackURL.absoluteString])
                    return
                }
                if let e = error as? ASWebAuthenticationSessionError, e.code == .canceledLogin {
                    call.reject("로그인을 취소했습니다", "CANCELED")
                    return
                }
                call.reject(error?.localizedDescription ?? "로그인 창을 열지 못했습니다", "FAILED")
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = ephemeral
            self.session = session
            if !session.start() {
                self.session = nil
                call.reject("로그인 창을 열지 못했습니다", "FAILED")
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}

/// 애플로 로그인 — 받은 identityToken 을 웹이 Supabase(signInWithIdToken)로 넘긴다.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]

    private var pending: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        let nonce = call.getString("nonce")
        DispatchQueue.main.async {
            if let old = self.pending {
                old.reject("다른 로그인이 시작되었습니다", "CANCELED")
            }
            self.pending = call
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            if let nonce = nonce, !nonce.isEmpty { request.nonce = nonce }
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let call = pending else { return }
        pending = nil
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            call.reject("애플 로그인 정보를 받지 못했습니다", "FAILED")
            return
        }
        var result: [String: Any] = ["identityToken": token, "user": credential.user]
        if let code = credential.authorizationCode, let s = String(data: code, encoding: .utf8) { result["authorizationCode"] = s }
        if let email = credential.email { result["email"] = email }
        if let given = credential.fullName?.givenName { result["givenName"] = given }
        if let family = credential.fullName?.familyName { result["familyName"] = family }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = pending else { return }
        pending = nil
        if let e = error as? ASAuthorizationError, e.code == .canceled {
            call.reject("로그인을 취소했습니다", "CANCELED")
            return
        }
        call.reject(error.localizedDescription, "FAILED")
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
