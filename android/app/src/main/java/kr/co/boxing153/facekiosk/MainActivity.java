package kr.co.boxing153.facekiosk;

import android.Manifest;
import android.app.ActivityManager;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

/**
 * 153 얼굴 출석 키오스크 — 무인 운영용 액티비티.
 *
 *  - 화면이 꺼지거나 잠기지 않는다(무인 키오스크의 최소 조건).
 *  - 하단 내비게이션 바를 숨겨 회원이 홈으로 못 나가게 한다.
 *  - 카메라 권한을 실행 즉시 요청한다(웹뷰 getUserMedia 가 이 권한을 탄다).
 *  - 화면 고정(앱 이탈 잠금)은 기본 꺼짐 — res/values/kiosk.xml 에서 켠다.
 *    ※ 켜기 전에 반드시 탈출 방법을 익히세요: [뒤로]+[최근앱] 동시에 길게 누르기.
 *    ※ 확인창 없이 조용히 잠그려면 기기를 소유자 모드로:
 *       adb shell dpm set-device-owner kr.co.boxing153.facekiosk/.DeviceAdminReceiver
 */
public class MainActivity extends BridgeActivity {

    private static final int REQ_CAMERA = 1153;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
              | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
              | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{ Manifest.permission.CAMERA }, REQ_CAMERA);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        maybeStartPinning();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
              | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
              | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
              | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
              | View.SYSTEM_UI_FLAG_FULLSCREEN
              | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    /** kiosk.xml 의 kiosk_pin_screen 이 true 일 때만 화면을 고정한다. */
    private void maybeStartPinning() {
        try {
            if (!getResources().getBoolean(R.bool.kiosk_pin_screen)) return;
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
            ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
            if (am != null && am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
                startLockTask();
            }
        } catch (Exception ignored) {
            // 잠금 실패가 출석을 막아서는 안 된다 — 조용히 넘어간다.
        }
    }
}
