import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'api_service.dart';

class CareerProvider with ChangeNotifier {
  // Resumes State
  List<dynamic> _resumes = [];
  bool _resumesLoading = false;
  Map<String, dynamic>? _selectedResume;

  List<dynamic> get resumes => _resumes;
  bool get resumesLoading => _resumesLoading;
  Map<String, dynamic>? get selectedResume => _selectedResume;

  // Analysis / Job Match State
  List<dynamic> _analyses = [];
  bool _analysesLoading = false;
  Map<String, dynamic>? _activeAnalysis;

  List<dynamic> get analyses => _analyses;
  bool get analysesLoading => _analysesLoading;
  Map<String, dynamic>? get activeAnalysis => _activeAnalysis;

  // Roadmap State
  Map<String, dynamic>? _activeRoadmap;
  bool _roadmapLoading = false;

  Map<String, dynamic>? get activeRoadmap => _activeRoadmap;
  bool get roadmapLoading => _roadmapLoading;

  // API Keys / Settings State
  List<dynamic> _apiKeys = [];
  bool _keysLoading = false;

  List<dynamic> get apiKeys => _apiKeys;
  bool get keysLoading => _keysLoading;

  // AI Career Mentor Chat State
  List<Map<String, dynamic>> _chatMessages = [];
  bool _chatLoading = false;
  bool _isChatStreaming = false;
  String _chatStreamText = '';
  String _routedAgent = 'career';
  String _routingExplanation = '';

  List<Map<String, dynamic>> get chatMessages => _chatMessages;
  bool get chatLoading => _chatLoading;
  bool get isChatStreaming => _isChatStreaming;
  String get chatStreamText => _chatStreamText;
  String get routedAgent => _routedAgent;
  String get routingExplanation => _routingExplanation;

  // General Error State
  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  // --- Resumes Actions ---
  Future<void> fetchResumes() async {
    _resumesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.get('/resume/my');
      _resumes = data ?? [];
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _resumesLoading = false;
      notifyListeners();
    }
  }

  Future<void> selectResume(String resumeId) async {
    _resumesLoading = true;
    notifyListeners();

    try {
      final data = await ApiService.get('/resume/$resumeId');
      _selectedResume = data;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _resumesLoading = false;
      notifyListeners();
    }
  }

  Future<bool> uploadResumeFile(Uint8List fileBytes, String fileName) async {
    _resumesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.uploadResume(fileBytes, fileName);
      if (data != null && data.containsKey('id')) {
        await fetchResumes();
        return true;
      }
      return false;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _resumesLoading = false;
      notifyListeners();
    }
  Future<bool> deleteResume(String resumeId) async {
    _resumesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.delete('/resume/$resumeId');
      _resumes.removeWhere((r) => r['id'] == resumeId);
      if (_selectedResume != null && _selectedResume!['id'] == resumeId) {
        _selectedResume = null;
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _resumesLoading = false;
      notifyListeners();
    }
  }

  // --- Job Match Actions ---
  Future<void> fetchAnalyses() async {
    _analysesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.get('/analysis/my');
      _analyses = data ?? [];
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _analysesLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> fetchAnalysisDetails(String analysisId) async {
    _analysesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.get('/analysis/$analysisId');
      _activeAnalysis = data;
      if (data != null && data['roadmap'] != null) {
        _activeRoadmap = data['roadmap'];
      } else {
        _activeRoadmap = null;
      }
      return data;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return null;
    } finally {
      _analysesLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>?> compareResumeToJob({
    required String resumeId,
    required String jdText,
    String? title,
    String? company,
  }) async {
    _analysesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.post('/analysis/compare', {
        'resume_id': resumeId,
        'jd_text': jdText,
        'title': title,
        'company': company,
      });
      _activeAnalysis = data;
      _activeRoadmap = null; // Reset roadmap for new analysis
      await fetchAnalyses();
      return data;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return null;
    } finally {
      _analysesLoading = false;
      notifyListeners();
    }
  Future<bool> deleteAnalysis(String analysisId) async {
    _analysesLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.delete('/analysis/$analysisId');
      _analyses.removeWhere((a) => a['id'] == analysisId);
      if (_activeAnalysis != null && _activeAnalysis!['id'] == analysisId) {
        _activeAnalysis = null;
        _activeRoadmap = null;
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _analysesLoading = false;
      notifyListeners();
    }
  }

  // --- Roadmap Actions ---
  Future<bool> generateLearningRoadmap(String analysisId) async {
    _roadmapLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.post('/analysis/$analysisId/roadmap', {});
      _activeRoadmap = data;
      if (_activeAnalysis != null) {
        _activeAnalysis!['roadmap'] = data;
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _roadmapLoading = false;
      notifyListeners();
    }
  }

  void updateActiveRoadmapLocal(Map<String, dynamic> roadmap) {
    _activeRoadmap = roadmap;
    notifyListeners();
  }

  Future<bool> deleteRoadmap(String analysisId) async {
    _roadmapLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.delete('/analysis/$analysisId/roadmap');
      _activeRoadmap = null;
      if (_activeAnalysis != null && _activeAnalysis!['id'] == analysisId) {
        _activeAnalysis!['roadmap'] = null;
      }
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _roadmapLoading = false;
      notifyListeners();
    }
  }

  // --- Settings / API Keys Actions ---
  Future<void> fetchApiKeys() async {
    _keysLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.get('/settings/keys');
      _apiKeys = data ?? [];
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _keysLoading = false;
      notifyListeners();
    }
  }

  Future<bool> saveApiKey(String provider, String apiKey) async {
    _keysLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.post('/settings/keys', {
        'provider': provider,
        'api_key': apiKey,
      });
      await fetchApiKeys();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _keysLoading = false;
      notifyListeners();
    }
  }

  Future<bool> deleteApiKey(String provider) async {
    _keysLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.delete('/settings/keys/$provider');
      await fetchApiKeys();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _keysLoading = false;
      notifyListeners();
    }
  }

  // --- Mentor Chat Actions ---
  Future<void> fetchChatHistory() async {
    _chatLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.get('/mentor/history');
      _chatMessages = (data as List).map<Map<String, dynamic>>((item) {
        return {
          'role': item['sender'] == 'user' ? 'user' : 'assistant',
          'content': item['message'],
        };
      }).toList();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _chatLoading = false;
      notifyListeners();
    }
  }

  void addLocalMessage(String role, String content) {
    _chatMessages.add({'role': role, 'content': content});
    notifyListeners();
  }

  Future<void> sendChatMessage(String content) async {
    // Add user's message locally first
    addLocalMessage('user', content);

    _isChatStreaming = true;
    _chatStreamText = '';
    _routedAgent = 'career';
    _routingExplanation = 'Analyzing message routing...';
    notifyListeners();

    // Set up message payload to send (limit to last 10 messages for context size efficiency)
    final startIdx = _chatMessages.length > 10 ? _chatMessages.length - 10 : 0;
    final payloadMessages = _chatMessages
        .sublist(startIdx)
        .map((m) => {
              'role': m['role'],
              'content': m['content'],
            })
        .toList();

    StreamSubscription<Map<String, dynamic>>? subscription;

    try {
      final chatStream = ApiService.connectMentorChatStream(payloadMessages);

      subscription = chatStream.listen(
        (event) {
          if (event.containsKey('event')) {
            final eventType = event['event'];
            if (eventType == 'route') {
              _routedAgent = event['agent'] ?? 'career';
              _routingExplanation = event['explanation'] ?? '';
              notifyListeners();
            } else if (eventType == 'token') {
              _chatStreamText += event['text'] ?? '';
              notifyListeners();
            } else if (eventType == 'error') {
              _errorMessage = event['detail'] ?? 'An error occurred during chat stream.';
              _isChatStreaming = false;
              notifyListeners();
              subscription?.cancel();
            }
          }
        },
        onError: (err) {
          _errorMessage = err.toString().replaceAll('Exception: ', '');
          _isChatStreaming = false;
          notifyListeners();
        },
        onDone: () {
          if (_chatStreamText.isNotEmpty) {
            addLocalMessage('assistant', _chatStreamText);
          }
          _isChatStreaming = false;
          _chatStreamText = '';
          notifyListeners();
        },
        cancelOnError: true,
      );
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isChatStreaming = false;
      notifyListeners();
    }
  }

  void clearChatMessages() {
    _chatMessages.clear();
    notifyListeners();
  }

  Future<bool> clearChatHistory() async {
    _chatLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await ApiService.delete('/mentor/history');
      _chatMessages.clear();
      _chatStreamText = '';
      _routedAgent = 'career';
      _routingExplanation = '';
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _chatLoading = false;
      notifyListeners();
    }
  }
}
