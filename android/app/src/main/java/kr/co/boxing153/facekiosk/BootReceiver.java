package kr.co.boxing153.facekiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 전원이 들어오면 키오스크를 자동으로 띄운다.
 * 정전·재부팅 후 사람이 가서 앱을 켜야 하는 상황을 없애기 위한 것.
 *
 * 참고: 안드로이드 10+ 는 백그라운드에서 화면을 띄우는 걸 제한한다.
 *       이게 막히는 기기라면 AndroidManifest 의 HOME 카테고리 주석을 풀어
 *       이 앱을 기본 런처로 만드는 방법이 가장 확실하다.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) return;
        try {
            Intent launch = new Intent(context, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            context.startActivity(launch);
        } catch (Exception ignored) { }
    }
}
