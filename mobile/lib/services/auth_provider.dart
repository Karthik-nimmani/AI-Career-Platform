import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class AuthProvider with ChangeNotifier {
  bool _isAuthenticated = false;
  bool _isLoading = true;
  Map<String, dynamic>? _user;
  String? _errorMessage;

  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  Map<String, dynamic>? get user => _user;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    tryAutoLogin();
  }

  // Restore session on startup
  Future<void> tryAutoLogin() async {
    _isLoading = true;
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      if (!prefs.containsKey('access_token')) {
        _isLoading = false;
        notifyListeners();
        return;
      }

      final token = prefs.getString('access_token');
      ApiService.setToken(token);

      // Verify the token by calling /auth/me
      final userData = await ApiService.get('/auth/me');
      _user = userData;
      _isAuthenticated = true;
    } catch (e) {
      // Token might be invalid/expired, clear it
      await logout();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Login
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.post('/auth/login', {
        'email': email,
        'password': password,
      });

      final token = data['access_token'];
      _user = data['user'];
      _isAuthenticated = true;

      // Persist token & user locally
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('access_token', token);
      if (data['refresh_token'] != null) {
        await prefs.setString('refresh_token', data['refresh_token']);
      }
      await prefs.setString('user_data', jsonEncode(_user));

      ApiService.setToken(token);
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Register
  Future<bool> register(String email, String password, String fullName) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await ApiService.post('/auth/register', {
        'email': email,
        'password': password,
        'full_name': fullName,
      });

      // If registration returns tokens (auto-logged in)
      if (data.containsKey('access_token')) {
        final token = data['access_token'];
        _user = data['user'];
        _isAuthenticated = true;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('access_token', token);
        if (data['refresh_token'] != null) {
          await prefs.setString('refresh_token', data['refresh_token']);
        }
        await prefs.setString('user_data', jsonEncode(_user));

        ApiService.setToken(token);
        return true;
      } else {
        // Successful but requires email validation
        _errorMessage = 'Verification required. Please check your email inbox to confirm registration.';
        return false;
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Logout
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();

    try {
      if (_isAuthenticated) {
        await ApiService.post('/auth/logout', {});
      }
    } catch (_) {
      // Ignore network errors on logout to allow offline signout
    }

    _isAuthenticated = false;
    _user = null;
    ApiService.setToken(null);

    // Clear local storage
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_data');

    _isLoading = false;
    notifyListeners();
  }

  // Clear errors
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
