import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/career_provider.dart';
import '../widgets/glass_container.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final Map<String, TextEditingController> _controllers = {
    'openai': TextEditingController(),
    'anthropic': TextEditingController(),
    'google': TextEditingController(),
  };

  final Map<String, bool> _obscureText = {
    'openai': true,
    'anthropic': true,
    'google': true,
  };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CareerProvider>(context, listen: false).fetchApiKeys();
    });
  }

  @override
  void dispose() {
    for (var controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _saveKey(String provider) async {
    final key = _controllers[provider]!.text.trim();
    if (key.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${provider.toUpperCase()} key cannot be empty'),
          backgroundColor: Colors.orangeAccent,
        ),
      );
      return;
    }

    // Basic syntax checks matching backend
    if (provider == 'openai' && !key.startsWith('sk-')) {
      _showError('Invalid OpenAI format. Key must start with "sk-".');
      return;
    }
    if (provider == 'anthropic' && !key.startsWith('sk-ant-')) {
      _showError('Invalid Anthropic format. Key must start with "sk-ant-".');
      return;
    }
    if (provider == 'google' && key.length < 15) {
      _showError('Invalid Gemini format. Key length is too short.');
      return;
    }

    final careerProvider = Provider.of<CareerProvider>(context, listen: false);
    final success = await careerProvider.saveApiKey(provider, key);

    if (!mounted) return;

    if (success) {
      _controllers[provider]!.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved ${provider == "google" ? "Gemini" : provider.toUpperCase()} API key successfully'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (careerProvider.errorMessage != null) {
      _showError(careerProvider.errorMessage!);
      careerProvider.clearError();
    }
  }

  Future<void> _deleteKey(String provider) async {
    final careerProvider = Provider.of<CareerProvider>(context, listen: false);
    final success = await careerProvider.deleteApiKey(provider);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Deleted ${provider == "google" ? "Gemini" : provider.toUpperCase()} API key'),
          backgroundColor: Colors.blueAccent,
        ),
      );
    } else if (careerProvider.errorMessage != null) {
      _showError(careerProvider.errorMessage!);
      careerProvider.clearError();
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.redAccent,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final careerProvider = Provider.of<CareerProvider>(context);

    // Map the returned key status list for easy lookup
    final Map<String, Map<String, dynamic>> keyStatusMap = {};
    for (var keyObj in careerProvider.apiKeys) {
      keyStatusMap[keyObj['provider']] = keyObj;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('API Settings'),
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
      ),
      body: careerProvider.keysLoading && careerProvider.apiKeys.isEmpty
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Info Card
                  GlassContainer(
                    backgroundColor: const Color(0xFF1E1B4B).withOpacity(0.4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.info_outline_rounded, color: Color(0xFF6366F1), size: 20),
                            SizedBox(width: 8),
                            Text(
                              'User-Controlled API Keys',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'To prevent server-side quota issues, all AI operations run using your own API credentials. Keys are saved securely in your private vault.',
                          style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 13, height: 1.4),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          '💡 Tip: Google Gemini offers a highly generous free tier for developers, bypassing cost issues.',
                          style: TextStyle(color: Colors.greenAccent, fontSize: 12, fontWeight: FontWeight.w500),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  const Text(
                    'Configured Providers',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),

                  // Providers list
                  _buildProviderKeyField(
                    providerId: 'google',
                    displayName: 'Google Gemini API',
                    subtitle: 'Recommended for free tier usage',
                    status: keyStatusMap['google'],
                    careerProvider: careerProvider,
                  ),
                  const SizedBox(height: 16),
                  _buildProviderKeyField(
                    providerId: 'openai',
                    displayName: 'OpenAI API',
                    subtitle: 'Powers resume parsing & ATS calculations',
                    status: keyStatusMap['openai'],
                    careerProvider: careerProvider,
                  ),
                  const SizedBox(height: 16),
                  _buildProviderKeyField(
                    providerId: 'anthropic',
                    displayName: 'Anthropic Claude API',
                    subtitle: 'Executes career mentor prompts',
                    status: keyStatusMap['anthropic'],
                    careerProvider: careerProvider,
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildProviderKeyField({
    required String providerId,
    required String displayName,
    required String subtitle,
    required Map<String, dynamic>? status,
    required CareerProvider careerProvider,
  }) {
    final hasKey = status != null ? (status['has_key'] ?? false) : false;
    final maskedVal = status != null ? (status['masked_key'] ?? '') : '';

    return GlassContainer(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    displayName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                  ),
                ],
              ),
              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: hasKey ? Colors.green.withOpacity(0.15) : Colors.orange.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: hasKey ? Colors.green.withOpacity(0.3) : Colors.orange.withOpacity(0.3),
                  ),
                ),
                child: Text(
                  hasKey ? 'Configured' : 'Missing',
                  style: TextStyle(
                    color: hasKey ? Colors.greenAccent : Colors.orangeAccent,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (hasKey) ...[
            // Masked key row
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_rounded, size: 16, color: Colors.green),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      maskedVal,
                      style: const TextStyle(
                        fontFamily: 'Courier',
                        fontSize: 14,
                        letterSpacing: 1.0,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                    onPressed: () {
                      showDialog(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          title: const Text('Delete API Key'),
                          content: Text('Are you sure you want to remove your stored $displayName key?'),
                          actions: [
                            TextButton(
                              child: const Text('Cancel'),
                              onPressed: () => Navigator.pop(ctx),
                            ),
                            TextButton(
                              child: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                              onPressed: () {
                                Navigator.pop(ctx);
                                _deleteKey(providerId);
                              },
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),
          ] else ...[
            // Form input row
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controllers[providerId],
                    obscureText: _obscureText[providerId]!,
                    style: const TextStyle(fontSize: 14),
                    decoration: InputDecoration(
                      hintText: 'Enter API Key',
                      hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                      prefixIcon: const Icon(Icons.key_rounded, size: 18),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscureText[providerId]! ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          size: 18,
                        ),
                        onPressed: () {
                          setState(() {
                            _obscureText[providerId] = !_obscureText[providerId]!;
                          });
                        },
                      ),
                      contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Color(0xFF6366F1)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: () => _saveKey(providerId),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF6366F1),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                    elevation: 0,
                  ),
                  child: const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
