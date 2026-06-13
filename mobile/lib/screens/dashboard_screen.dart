import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_provider.dart';
import '../services/career_provider.dart';
import '../widgets/glass_container.dart';
import 'resume_upload_screen.dart';
import 'job_compare_screen.dart';
import 'roadmap_screen.dart';
import 'mentor_chat_screen.dart';
import 'settings_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final careerProvider = Provider.of<CareerProvider>(context, listen: false);
      careerProvider.fetchResumes();
      careerProvider.fetchAnalyses();
      careerProvider.fetchApiKeys();
    });
  }

  Future<void> _refresh() async {
    final careerProvider = Provider.of<CareerProvider>(context, listen: false);
    await Future.wait([
      careerProvider.fetchResumes(),
      careerProvider.fetchAnalyses(),
      careerProvider.fetchApiKeys(),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final careerProvider = Provider.of<CareerProvider>(context);
    final user = authProvider.user;

    final activeKeysCount = careerProvider.apiKeys.where((key) => key['has_key'] == true).length;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF6366F1).withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                color: Color(0xFF6366F1),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'AICareer Intel',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
            tooltip: 'Log Out',
            onPressed: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Log Out'),
                  content: const Text('Are you sure you want to log out of your account?'),
                  actions: [
                    TextButton(
                      child: const Text('Cancel'),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                    TextButton(
                      child: const Text('Log Out', style: TextStyle(color: Colors.redAccent)),
                      onPressed: () {
                        Navigator.pop(ctx);
                        authProvider.logout();
                      },
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: const Color(0xFF6366F1),
        backgroundColor: const Color(0xFF141320),
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 16.0),
          physics: const AlwaysScrollableScrollPhysics(),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome Header
              Text(
                'Hi, ${user != null ? (user['full_name'] ?? user['email'].split('@')[0]) : 'User'} 👋',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Ready to accelerate your career alignment today?',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.5),
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 24),

              // Overview Stats Row
              Row(
                children: [
                  Expanded(
                    child: _buildStatCard(
                      label: 'Resumes',
                      value: careerProvider.resumes.length.toString(),
                      icon: Icons.description_rounded,
                      color: const Color(0xFF6366F1),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      label: 'Analyses',
                      value: careerProvider.analyses.length.toString(),
                      icon: Icons.analytics_rounded,
                      color: const Color(0xFF10B981),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildStatCard(
                      label: 'Active Keys',
                      value: '$activeKeysCount/3',
                      icon: Icons.key_rounded,
                      color: const Color(0xFF8B5CF6),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 28),

              // Modules grid
              const Text(
                'Platform Modules',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              GridView.count(
                shrinkWrap: true,
                crossAxisCount: 2,
                crossAxisSpacing: 16,
                mainAxisSpacing: 16,
                childAspectRatio: 1.15,
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  _buildModuleCard(
                    context,
                    title: 'Resume Parser',
                    subtitle: 'Upload & ingest PDF resume',
                    icon: Icons.file_upload_outlined,
                    color: const Color(0xFF6366F1),
                    screen: const ResumeUploadScreen(),
                  ),
                  _buildModuleCard(
                    context,
                    title: 'ATS Matcher',
                    subtitle: 'Compare resume to JDs',
                    icon: Icons.compare_arrows_rounded,
                    color: const Color(0xFF10B981),
                    screen: const JobCompareScreen(),
                  ),
                  _buildModuleCard(
                    context,
                    title: 'Study Planner',
                    subtitle: 'Close your skill gaps',
                    icon: Icons.timeline_rounded,
                    color: const Color(0xFFF59E0B),
                    screen: const RoadmapScreen(),
                  ),
                  _buildModuleCard(
                    context,
                    title: 'AI Career Mentor',
                    subtitle: 'Chat with agent team',
                    icon: Icons.chat_bubble_outline_rounded,
                    color: const Color(0xFFEC4899),
                    screen: const MentorChatScreen(),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Settings quick access bar
              GestureDetector(
                onTap: () async {
                  await Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const SettingsScreen()),
                  );
                  if (context.mounted) {
                    _refresh();
                  }
                },
                child: GlassContainer(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B5CF6).withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.settings_outlined, color: Color(0xFF8B5CF6), size: 20),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Configure Custom API Keys',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text(
                              activeKeysCount > 0
                                  ? '$activeKeysCount keys configured. Settings active.'
                                  : 'Configure OpenAI, Claude, or Gemini keys.',
                              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      Icon(Icons.chevron_right_rounded, color: Colors.white.withOpacity(0.5)),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),

              // Recent Resumes List
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recent Resumes',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (careerProvider.resumes.isNotEmpty)
                    TextButton(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => const ResumeUploadScreen()),
                        );
                      },
                      child: const Text('View All', style: TextStyle(color: Color(0xFF6366F1))),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              careerProvider.resumesLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 20),
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                        ),
                      ),
                    )
                  : careerProvider.resumes.isEmpty
                      ? GlassContainer(
                          padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
                          child: Column(
                            children: [
                              Icon(Icons.description_outlined, size: 48, color: Colors.white.withOpacity(0.2)),
                              const SizedBox(height: 12),
                              const Text(
                                'No resumes uploaded yet',
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Upload a resume in the PDF parser to get started.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton.icon(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (context) => const ResumeUploadScreen()),
                                  );
                                },
                                icon: const Icon(Icons.upload_file_rounded),
                                label: const Text('Upload PDF'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF6366F1).withOpacity(0.2),
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.separated(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: careerProvider.resumes.length > 3 ? 3 : careerProvider.resumes.length,
                          separatorBuilder: (context, index) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final resume = careerProvider.resumes[index];
                            final parsedContent = resume['parsed_content'] ?? {};
                            final candidateName = parsedContent['personal_info']?['name'] ?? 'Parsed Resume';
                            final candidateRole = parsedContent['personal_info']?['title'] ?? 'Extracted Profile';

                            return GestureDetector(
                              onTap: () async {
                                await careerProvider.selectResume(resume['id']);
                                if (context.mounted) {
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => ResumeUploadScreen(viewingResumeId: resume['id']),
                                    ),
                                  );
                                  if (context.mounted) {
                                    _refresh();
                                  }
                                }
                              },
                              child: GlassContainer(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF6366F1).withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Icon(Icons.picture_as_pdf_outlined, color: Color(0xFF6366F1)),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            candidateName,
                                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            candidateRole,
                                            style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Colors.white.withOpacity(0.3)),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return GlassContainer(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Icon(icon, color: color, size: 18),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withOpacity(0.5),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildModuleCard(
    BuildContext context, {
    required String title,
    required String subtitle,
    required IconData icon,
    required Color color,
    required Widget screen,
  }) {
    return GestureDetector(
      onTap: () async {
        await Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => screen),
        );
        if (context.mounted) {
          _refresh();
        }
      },
      child: GlassContainer(
        padding: const EdgeInsets.all(14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.4),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
