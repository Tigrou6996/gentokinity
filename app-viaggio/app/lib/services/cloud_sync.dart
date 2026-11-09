import 'package:flutter/foundation.dart';
import '../models/trip.dart';
import 'auth.dart';
import 'demo.dart';
import 'trip_store.dart';

/// Copia dei viaggi sull'account (tabella Supabase "viaggi"), così si ritrovano su un altro telefono.
/// Funziona solo con un utente collegato; senza rete gli errori vengono ignorati e i viaggi restano sul telefono.
class CloudSync {
  static const table = 'viaggi';

  static Future<void> push(SavedTrip t) async {
    final c = AuthService.instance.client, u = AuthService.instance.user;
    if (c == null || u == null || Demo.isDemo(t)) return;
    try {
      await c.from(table).upsert({
        'user_id': u.id,
        'id': t.id,
        'dati': t.toJson(),
        'partenza': t.journey.departure?.toUtc().toIso8601String(),
        'aggiornato': DateTime.now().toUtc().toIso8601String(),
      }, onConflict: 'user_id,id');
    } catch (e) {
      debugPrint('CloudSync.push: $e');
    }
  }

  static Future<void> remove(SavedTrip t) async {
    final c = AuthService.instance.client, u = AuthService.instance.user;
    if (c == null || u == null) return;
    try {
      await c.from(table).delete().eq('user_id', u.id).eq('id', t.id);
    } catch (e) {
      debugPrint('CloudSync.remove: $e');
    }
  }

  /// All'accesso: scarica i viaggi dell'account e carica quelli presenti solo sul telefono.
  static Future<void> pull() async {
    final c = AuthService.instance.client, u = AuthService.instance.user;
    if (c == null || u == null) return;
    try {
      final rows = await c.from(table).select('dati').eq('user_id', u.id);
      final remote = <SavedTrip>[];
      for (final r in rows) {
        try {
          remote.add(SavedTrip.fromJson(Map<String, dynamic>.from(r['dati'] as Map)));
        } catch (_) {}
      }
      final store = TripStore.instance;
      final localOnly = store.trips.where((t) => !remote.any((r) => r.id == t.id) && !Demo.isDemo(t)).toList();
      await store.mergeFromCloud(remote);
      for (final t in localOnly) {
        await push(t);
      }
    } catch (e) {
      debugPrint('CloudSync.pull: $e');
    }
  }
}
