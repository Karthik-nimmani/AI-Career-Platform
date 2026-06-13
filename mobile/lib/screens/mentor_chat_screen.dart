import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/career_provider.dart';
import '../widgets/glass_container.dart';
import 'settings_screen.dart';

class MentorChatScreen extends StatefulWidget {
  const MentorChatScreen({super.key});

  @override
  State<MentorChatScreen> createState() => _MentorChatScreenState();
}

class _MentorChatScreenState extends State<MentorChatScreen> {
  final _textController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final careerProvider = Provider.of<CareerProvider>(context, listen: false);
      careerProvider.fetchChatHistory();
      _scrollToBottom();
    });
  }

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      });
    }
  }

  Future<void> _sendMessage([String? textOverride]) async {
    final query = textOverride ?? _textController.text.trim();
    if (query.isEmpty) return;

    if (textOverride == null) {
      _textController.clear();
    }

    final careerProvider = Provider.of<CareerProvider>(context, listen: false);
    await careerProvider.sendChatMessage(query);
    _scrollToBottom();

    if (!mounted) return;

    if (careerProvider.errorMessage != null) {
      _handleAPIError(careerProvider.errorMessage!);
      careerProvider.clearError();
    }
  }

  void _handleAPIError(String error) {
    if (error.contains('Missing') && error.contains('API Key')) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('API Credentials Required'),
          content: Text(error),
          actions: [
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.pop(ctx),
            ),
            TextButton(
              child: const Text('Configure Keys', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6366F1))),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const SettingsScreen()),
                );
              },
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final careerProvider = Provider.of<CareerProvider>(context);
    final isStreaming = careerProvider.isChatStreaming;
    final streamText = careerProvider.chatStreamText;
    final messages = careerProvider.chatMessages;

    // Trigger auto-scroll on new token arrivals
    if (isStreaming) {
      _scrollToBottom();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Career Mentor'),
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.delete_sweep_outlined, color: Colors.white60),
            tooltip: 'Clear Chat',
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Clear Chat Logs'),
                  content: const Text('Do you want to reset your conversation log? this will also erase history on the server.'),
                  actions: [
                    TextButton(child: const Text('Cancel'), onPressed: () => Navigator.pop(ctx)),
                    TextButton(
                      child: const Text('Reset', style: TextStyle(color: Colors.redAccent)),
                      onPressed: () async {
                        Navigator.pop(ctx);
                        await careerProvider.clearChatHistory();
                      },
                    ),
                  ],
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Dynamic LangGraph classification banner
          if (isStreaming) _buildRoutingBanner(careerProvider),

          // Messages area
          Expanded(
            child: careerProvider.chatLoading && messages.isEmpty
                ? const Center(
                    child: CircularProgressIndicator(
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                    ),
                  )
                : messages.isEmpty
                    ? _buildChatSuggestions()
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(20),
                        itemCount: messages.length + (isStreaming ? 1 : 0),
                        itemBuilder: (context, index) {
                          // Renders streaming token bubble at the very end
                          if (index == messages.length) {
                            return _buildMessageBubble(
                              role: 'assistant',
                              content: streamText,
                              isStreamingToken: true,
                            );
                          }

                          final msg = messages[index];
                          return _buildMessageBubble(
                            role: msg['role'] ?? 'user',
                            content: msg['content'] ?? '',
                          );
                        },
                      ),
          ),

          // Input area bar
          _buildInputBar(isStreaming),
        ],
      ),
    );
  }

  Widget _buildRoutingBanner(CareerProvider provider) {
    final agentName = {
      'resume_analyst': 'Resume Analyst Agent',
      'skill_advisor': 'Skill Advisor Agent',
      'interview_coach': 'Interview Coach Agent',
      'career_architect': 'Career Architect Agent',
      'career': 'Career Mentor Orchestrator',
    }[provider.routedAgent] ?? provider.routedAgent.toUpperCase();

    final agentColor = {
      'resume_analyst': const Color(0xFF6366F1),
      'skill_advisor': const Color(0xFFF59E0B),
      'interview_coach': const Color(0xFF10B981),
      'career_architect': const Color(0xFFEC4899),
      'career': const Color(0xFF8B5CF6),
    }[provider.routedAgent] ?? const Color(0xFF6366F1);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: agentColor.withOpacity(0.08),
      border: Border(bottom: BorderSide(color: agentColor.withOpacity(0.2), width: 0.5)),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(color: agentColor.withOpacity(0.2), shape: BoxShape.circle),
            child: const Icon(Icons.hub_rounded, size: 14, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Routed to: $agentName',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: agentColor),
                ),
                const SizedBox(height: 1),
                Text(
                  provider.routingExplanation,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.5)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChatSuggestions() {
    final suggestions = [
      'Analyze my resume gaps',
      'Conduct a mock technical interview',
      'Recommend resources to learn TypeScript',
      'How does my profile match the market?',
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFFEC4899).withOpacity(0.1), shape: BoxShape.circle),
            child: const Icon(Icons.chat_bubble_outline_rounded, size: 40, color: Color(0xFFEC4899)),
          ),
          const SizedBox(height: 16),
          const Text('Multi-Agent Chat Workspace', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          Text(
            'Ask our specialized team of agents for direct feedback, resume evaluations, roadmaps, or technical mock training.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 32),
          ...suggestions.map((s) => Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: GestureDetector(
                  onTap: () => _sendMessage(s),
                  child: GlassContainer(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        const Icon(Icons.question_answer_outlined, size: 16, color: Color(0xFFEC4899)),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            s,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                          ),
                        ),
                        Icon(Icons.send_rounded, size: 14, color: Colors.white.withOpacity(0.3)),
                      ],
                    ),
                  ),
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildMessageBubble({
    required String role,
    required String content,
    bool isStreamingToken = false,
  }) {
    final bool isUser = role == 'user';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisAlignment: isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            Container(
              margin: const EdgeInsets.only(right: 10),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFEC4899).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.smart_toy_outlined, size: 16, color: Color(0xFFEC4899)),
            ),
          ],
          Flexible(
            child: GlassContainer(
              backgroundColor: isUser
                  ? const Color(0xFF1E1B4B).withOpacity(0.5)
                  : const Color(0xFF141320).withOpacity(0.7),
              padding: const EdgeInsets.all(12),
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isUser ? 16 : 4),
                bottomRight: Radius.circular(isUser ? 4 : 16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    content.isEmpty && isStreamingToken ? 'Thinking...' : content,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.5,
                      color: content.isEmpty && isStreamingToken 
                          ? Colors.white.withOpacity(0.4) 
                          : Colors.white.withOpacity(0.9),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isUser) ...[
            Container(
              margin: const EdgeInsets.only(left: 10),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.person_outline_rounded, size: 16, color: Color(0xFF6366F1)),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInputBar(bool isStreaming) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      color: const Color(0xFF08070D),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF141320),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: TextField(
                  controller: _textController,
                  style: const TextStyle(fontSize: 14),
                  maxLines: 4,
                  minLines: 1,
                  decoration: InputDecoration(
                    hintText: 'Type your message...',
                    hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Container(
              decoration: const BoxDecoration(
                color: Color(0xFFEC4899),
                shape: BoxShape.circle,
              ),
              child: IconButton(
                icon: isStreaming
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          strokeWidth: 2,
                        ),
                      )
                    : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                onPressed: isStreaming ? null : () => _sendMessage(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
