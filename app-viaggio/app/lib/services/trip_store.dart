import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/trip.dart';

/// Viaggi e biglietti salvati sul telefono (file JSON + copie dei biglietti nella cartella dell'app).
class TripStore extends ChangeNotifier {
  TripStore._();
  static final TripStore instance = TripStore._();

  final List<SavedTrip> trips = [];
  Directory? _dir;

  Future<Directory> get dir async => _dir ??= await getApplicationDocumentsDirectory();
  Future<File> get _file async => File('${(await dir).path}/viaggi.json');

  Future<void> load() async {
    try {
      String? txt;
      if (kIsWeb) {
        txt = (await SharedPreferences.getInstance()).getString('viaggi'); // nel browser: memoria del sito
      } else {
        final f = await _file;
        if (!await f.exists()) return;
        txt = await f.readAsString();
      }
      if (txt == null) return;
      final list = jsonDecode(txt) as List;
      trips
        ..clear()
        ..addAll(list.whereType<Map>().map((m) => SavedTrip.fromJson(Map<String, dynamic>.from(m))));
      trips.sort((a, b) => (a.journey.departure ?? a.createdAt).compareTo(b.journey.departure ?? b.createdAt));
      notifyListeners();
    } catch (e) {
      debugPrint('TripStore.load: $e');
    }
  }

  Future<void> _save() async {
    if (kIsWeb) {
      await (await SharedPreferences.getInstance()).setString('viaggi', jsonEncode(trips.map((t) => t.toJson()).toList()));
      notifyListeners();
      return;
    }
    final f = await _file;
    final tmp = File('${f.path}.tmp');
    await tmp.writeAsString(jsonEncode(trips.map((t) => t.toJson()).toList()));
    await tmp.rename(f.path);
    notifyListeners();
  }

  Future<void> upsert(SavedTrip t) async {
    final i = trips.indexWhere((x) => x.id == t.id);
    if (i >= 0) {
      trips[i] = t;
    } else {
      trips.add(t);
    }
    trips.sort((a, b) => (a.journey.departure ?? a.createdAt).compareTo(b.journey.departure ?? b.createdAt));
    await _save();
  }

  Future<void> remove(SavedTrip t) async {
    trips.removeWhere((x) => x.id == t.id);
    final p = t.ticket.filePath;
    if (p != null && !kIsWeb) {
      try {
        await File(p).delete();
      } catch (_) {}
    }
    await _save();
  }

  /// Copia il file del biglietto dentro l'app, così resta disponibile anche se l'originale viene cancellato.
  Future<String> keepTicketFile(String sourcePath) async {
    final ext = sourcePath.contains('.') ? sourcePath.substring(sourcePath.lastIndexOf('.')) : '';
    final d = Directory('${(await dir).path}/biglietti');
    await d.create(recursive: true);
    final dest = '${d.path}/${DateTime.now().millisecondsSinceEpoch}$ext';
    await File(sourcePath).copy(dest);
    return dest;
  }
}
