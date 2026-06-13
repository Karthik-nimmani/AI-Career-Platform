import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:http/http.dart' as http;

class ApiService {
  // Configurable base URL. Default to 10.0.2.2 for Android Emulator, fallback to localhost
  static String baseUrl = 'http://10.0.2.2:8000';

  // In-memory token storage (synced with AuthProvider and persistent store)
  static String? _token;

  static void setToken(String? token) {
    _token = token;
  }

  static Map<String, String> _headers({bool multipart = false}) {
    final Map<String, String> headers = {};
    if (!multipart) {
      headers['Content-Type'] = 'application/json';
    }
    if (_token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  // GET Request
  static Future<dynamic> get(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final response = await http.get(uri, headers: _headers());
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // POST Request
  static Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final response = await http.post(
        uri,
        headers: _headers(),
        body: jsonEncode(body),
      );
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // DELETE Request
  static Future<dynamic> delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    try {
      final response = await http.delete(uri, headers: _headers());
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  // Multipart PDF upload request
  static Future<dynamic> uploadResume(Uint8List fileBytes, String fileName) async {
    final uri = Uri.parse('$baseUrl/resume/upload');
    try {
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(_headers(multipart: true));

      final multipartFile = http.MultipartFile.fromBytes(
        'file',
        fileBytes,
        filename: fileName,
      );
      request.files.add(multipartFile);

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      return _handleResponse(response);
    } catch (e) {
      throw Exception('Resume upload network error: $e');
    }
  }

  // Connect Server-Sent Events (SSE) Stream for AI Chat
  static Stream<Map<String, dynamic>> connectMentorChatStream(List<Map<String, dynamic>> messages) {
    final controller = StreamController<Map<String, dynamic>>();
    final uri = Uri.parse('$baseUrl/mentor/chat');

    final client = http.Client();
    final request = http.Request('POST', uri)
      ..headers.addAll(_headers())
      ..body = jsonEncode({'messages': messages});

    Future<void> runStream() async {
      try {
        final streamedResponse = await client.send(request);
        if (streamedResponse.statusCode != 200) {
          final errBody = await streamedResponse.stream.bytesToString();
          String errMsg = 'Failed to connect stream: $errBody';
          try {
            final parsed = jsonDecode(errBody);
            errMsg = parsed['detail'] ?? errMsg;
          } catch (_) {}
          controller.addError(Exception(errMsg));
          controller.close();
          client.close();
          return;
        }

        // Listen to the SSE stream line by line
        streamedResponse.stream
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .listen(
          (line) {
            if (line.trim().isEmpty) return;
            if (line.startsWith('data: ')) {
              final dataStr = line.substring(6).trim();
              if (dataStr == '[DONE]') {
                controller.close();
                client.close();
              } else {
                try {
                  final parsed = jsonDecode(dataStr);
                  controller.add(parsed);
                } catch (e) {
                  controller.addError(Exception('Failed to parse SSE event: $e'));
                }
              }
            }
          },
          onError: (err) {
            controller.addError(err);
            controller.close();
            client.close();
          },
          onDone: () {
            if (!controller.isClosed) {
              controller.close();
            }
            client.close();
          },
          cancelOnError: true,
        );
      } catch (e) {
        controller.addError(e);
        controller.close();
        client.close();
      }
    }

    runStream();
    return controller.stream;
  }

  // Helper response analyzer
  static dynamic _handleResponse(http.Response response) {
    final int code = response.statusCode;
    final String body = response.body;

    if (code >= 200 && code < 300) {
      if (body.isEmpty) return null;
      try {
        return jsonDecode(body);
      } catch (e) {
        return body;
      }
    } else {
      String errorMessage = 'Server returned status code $code';
      try {
        final parsed = jsonDecode(body);
        if (parsed is Map && parsed.containsKey('detail')) {
          errorMessage = parsed['detail'].toString();
        }
      } catch (_) {}
      throw Exception(errorMessage);
    }
  }
}
