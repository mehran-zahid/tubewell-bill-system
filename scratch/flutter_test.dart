// Instructions:
// 1. Open `p:\errand\lib\screens\home_screen.dart` in your editor.
// 2. Add these two imports at the top of the file:
// import 'dart:convert';
// import 'package:http/http.dart' as http;
//
// 3. Add this `_testWapdaFetch` function inside the `_HomeScreenState` class:

  Future<void> _testWapdaFetch() async {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => const AlertDialog(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text("Fetching WAPDA bill (CORS bypass test)..."),
          ],
        ),
      ),
    );

    try {
      final refno = "29153110982900"; // Same ref used in our billing tab
      
      // Step 1: Fetch HTML
      final res1 = await http.get(Uri.parse("http://bill.pitc.com.pk/mepcobil/general?refno=$refno"));
      
      final cookies = res1.headers['set-cookie'] ?? '';
      final html = res1.body;

      // Extract tokens
      final viewStateMatch = RegExp(r'id="__VIEWSTATE"\s+value="([^"]+)"').firstMatch(html);
      final viewState = viewStateMatch != null ? viewStateMatch.group(1) : '';
      
      final tokenMatch = RegExp(r'__RequestVerificationToken"\s+type="hidden"\s+value="([^"]+)"').firstMatch(html);
      final reqToken = tokenMatch != null ? tokenMatch.group(1) : '';
      
      final monthMatch = RegExp(r'data-bill-month="([^"]+)"').firstMatch(html);
      final billMonth = monthMatch != null ? monthMatch.group(1) : '';
      
      final refMatch = RegExp(r'data-ref-no="([^"]+)"').firstMatch(html);
      final dataRefNo = refMatch != null ? refMatch.group(1) : '';

      // Step 2: Fetch Snaps using the API directly
      final postData = {
        'RefNo': dataRefNo,
        'BillMonth': billMonth,
        '__VIEWSTATE': viewState,
        '__RequestVerificationToken': reqToken,
      };

      final res2 = await http.post(
        Uri.parse('https://usersnap.pitc.com.pk/api/SnapsForDuplicateBill/ToDuplicate'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cookie': cookies,
        },
        body: jsonEncode(postData),
      );

      if (!mounted) return;
      Navigator.pop(context); // close loading

      if (res2.statusCode == 200) {
        final List snaps = jsonDecode(res2.body);
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Success!'),
            content: Text('Received ${snaps.length} images.\nLength of response: ${res2.body.length} chars.\n\nFirst snap keys: ${snaps.isNotEmpty ? (snaps[0] as Map).keys.toString() : "empty"}'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))
            ],
          ),
        );
      } else {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Error from usersnap API'),
            content: Text('Status Code: ${res2.statusCode}\nBody: ${res2.body}'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))
            ],
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context); // close loading
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Exception'),
          content: Text(e.toString()),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))
          ],
        ),
      );
    }
  }


// 4. Finally, update your AppBar in the `build` method of `_HomeScreenState` to include a button that calls this function:
// 
//       appBar: AppBar(
//         title: const Text('Errands'),
//         actions: [
//           IconButton(
//             icon: const Icon(Icons.download_rounded),
//             onPressed: _testWapdaFetch,
//             tooltip: 'Test WAPDA Fetch',
//           ),
//         ],
//       ),
