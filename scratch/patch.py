import os
import re

file_path = r'p:\errand\lib\screens\home_screen.dart'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
if 'package:http/http.dart' not in content:
    content = content.replace(
        "import 'package:flutter/material.dart';",
        "import 'dart:convert';\nimport 'package:http/http.dart' as http;\nimport 'package:flutter/material.dart';"
    )

# 2. _testWapdaFetch
test_func = """
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
      final viewStateMatch = RegExp(r'id="__VIEWSTATE"\\s+value="([^"]+)"').firstMatch(html);
      final viewState = viewStateMatch != null ? viewStateMatch.group(1) : '';
      
      final tokenMatch = RegExp(r'__RequestVerificationToken"\\s+type="hidden"\\s+value="([^"]+)"').firstMatch(html);
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
            content: Text('Received ${snaps.length} images.\\nLength of response: ${res2.body.length} chars.\\n\\nFirst snap keys: ${snaps.isNotEmpty ? (snaps[0] as Map).keys.toString() : "empty"}'),
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
            content: Text('Status Code: ${res2.statusCode}\\nBody: ${res2.body}'),
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

  @override
"""

if '_testWapdaFetch' not in content:
    content = content.replace("  @override\n  void dispose() {", test_func + "  void dispose() {")

# 3. AppBar
if 'icon: const Icon(Icons.download_rounded),' not in content:
    content = content.replace(
        "      appBar: AppBar(\n        title: const Text('Errands'),\n      ),",
        "      appBar: AppBar(\n        title: const Text('Errands'),\n        actions: [\n          IconButton(\n            icon: const Icon(Icons.download_rounded),\n            onPressed: _testWapdaFetch,\n            tooltip: 'Test WAPDA Fetch',\n          ),\n        ],\n      ),"
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied successfully.")
