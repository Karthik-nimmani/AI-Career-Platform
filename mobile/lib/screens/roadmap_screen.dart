import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/career_provider.dart';
import '../widgets/glass_container.dart';

class RoadmapScreen extends StatefulWidget {
  const RoadmapScreen({super.key});

  @override
  State<RoadmapScreen> createState() => _RoadmapScreenState();
}

class _RoadmapScreenState extends State<RoadmapScreen> {
  // Store ticked checkpoint keys: "analysisId_weekIndex_objectiveIndex" -> bool
  final Map<String, bool> _checkpoints = {};
  bool _checkpointsLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final careerProvider = Provider.of<CareerProvider>(context, listen: false);
      await careerProvider.fetchAnalyses();
      
      // Auto-load roadmap of the latest analysis if available
      final latestWithRoadmap = careerProvider.analyses.firstWhere(
        (a) => a['roadmap'] != null,
        orElse: () => null,
      );

      if (latestWithRoadmap != null && careerProvider.activeRoadmap == null) {
        await careerProvider.fetchAnalysisDetails(latestWithRoadmap['id']);
      }
      
      await _loadPersistedCheckpoints();
    });
  }

  Future<void> _loadPersistedCheckpoints() async {
    setState(() {
      _checkpointsLoading = true;
    });
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys();
      for (var k in keys) {
        if (k.startsWith('roadmap_checkpoint_')) {
          _checkpoints[k.replaceFirst('roadmap_checkpoint_', '')] = prefs.getBool(k) ?? false;
        }
      }
    } catch (_) {}
    setState(() {
      _checkpointsLoading = false;
    });
  }

  Future<void> _toggleCheckpoint(String analysisId, int weekIdx, int objIdx, bool isChecked) async {
    final key = '${analysisId}_${weekIdx}_$objIdx';
    setState(() {
      _checkpoints[key] = isChecked;
    });

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('roadmap_checkpoint_$key', isChecked);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final careerProvider = Provider.of<CareerProvider>(context);
    final activeAnalysis = careerProvider.activeAnalysis;
    final roadmap = careerProvider.activeRoadmap;

    final analysesWithRoadmaps = careerProvider.analyses.where((a) => a['roadmap'] != null).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Study Roadmap'),
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
      ),
      body: careerProvider.roadmapLoading || careerProvider.analysesLoading
          ? const Center(
              child: CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
              ),
            )
          : roadmap == null
              ? _buildNoRoadmapPlaceholder(analysesWithRoadmaps, careerProvider)
              : _buildRoadmapTimeline(roadmap, activeAnalysis?['id'] ?? 'default', analysesWithRoadmaps, careerProvider),
    );
  }

  Widget _buildNoRoadmapPlaceholder(List<dynamic> list, CareerProvider provider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GlassContainer(
            padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 20),
            child: Column(
              children: [
                Icon(Icons.route_rounded, size: 54, color: Colors.white.withOpacity(0.2)),
                const SizedBox(height: 16),
                const Text(
                  'No Active Study Plan',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  'Roadmaps are generated on demand from job description mismatch calculations.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12, height: 1.4),
                ),
              ],
            ),
          ),
          if (list.isNotEmpty) ...[
            const SizedBox(height: 28),
            const Text(
              'Select Past Study Roadmap',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 12),
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: list.length,
              separatorBuilder: (context, index) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final analysis = list[index];
                final title = analysis['job_descriptions']?['title'] ?? 'Study Plan';
                final company = analysis['job_descriptions']?['company'] ?? 'Target Role';
                final dateStr = analysis['created_at'] != null 
                    ? DateTime.parse(analysis['created_at']).toLocal().toString().split(' ')[0]
                    : 'Recent';

                return GestureDetector(
                  onTap: () async {
                    await provider.fetchAnalysisDetails(analysis['id']);
                  },
                  child: GlassContainer(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.menu_book_rounded, color: Color(0xFFF59E0B)),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              const SizedBox(height: 2),
                              Text(
                                '$company • $dateStr',
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
        ],
      ),
    );
  }

  Widget _buildRoadmapTimeline(
    Map<String, dynamic> roadmap,
    String analysisId,
    List<dynamic> pastRoadmaps,
    CareerProvider provider,
  ) {
    final role = roadmap['target_role'] ?? 'Target Role';
    final duration = roadmap['duration_weeks'] ?? 0;
    final List<dynamic> weeks = roadmap['weeks'] ?? [];

    return Column(
      children: [
        // Title banner
        Container(
          padding: const EdgeInsets.all(18),
          color: const Color(0xFF141320).withOpacity(0.3),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      role,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'AI Compiled Learning Syllabus ($duration Weeks)',
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                tooltip: 'Delete Study Plan',
                onPressed: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Delete Study Plan'),
                      content: const Text('Are you sure you want to delete this study plan? This will clear the generated roadmap and reset your progress objectives.'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
                          child: const Text('Delete'),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true) {
                    final success = await provider.deleteRoadmap(analysisId);
                    if (success) {
                      final prefs = await SharedPreferences.getInstance();
                      final keys = prefs.getKeys();
                      for (var k in keys) {
                        if (k.startsWith('roadmap_checkpoint_${analysisId}_')) {
                          await prefs.remove(k);
                        }
                      }
                      setState(() {
                        _checkpoints.removeWhere((key, _) => key.startsWith('${analysisId}_'));
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Study plan deleted successfully.'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    }
                  }
                },
              ),
              if (pastRoadmaps.length > 1)
                IconButton(
                  icon: const Icon(Icons.history_edu_rounded, color: Color(0xFFF59E0B)),
                  tooltip: 'Switch Roadmap',
                  onPressed: () {
                    _showSwitchRoadmapDialog(pastRoadmaps, provider);
                  },
                ),
            ],
          ),
        ),

        // Scrollable timeline
        Expanded(
          child: _checkpointsLoading
              ? const Center(child: CircularProgressIndicator())
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: weeks.length,
                  itemBuilder: (context, weekIdx) {
                    final weekObj = weeks[weekIdx];
                    final int weekNum = weekObj['week'] ?? (weekIdx + 1);
                    final String topic = weekObj['topic'] ?? '';
                    final List<dynamic> objectives = weekObj['objectives'] ?? [];
                    final List<dynamic> resources = weekObj['resources'] ?? [];

                    return Container(
                      margin: const EdgeInsets.only(bottom: 24),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Left side chronological number indicator
                          Column(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: const Color(0xFFF59E0B).withOpacity(0.1),
                                  border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.4)),
                                ),
                                child: Center(
                                  child: Text(
                                    '$weekNum',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFFF59E0B)),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 8),
                              // Vertical connecting line
                              if (weekIdx < weeks.length - 1)
                                Container(
                                  width: 2,
                                  height: 180, // Approximate height matching card contents
                                  color: Colors.white.withOpacity(0.08),
                                ),
                            ],
                          ),
                          const SizedBox(width: 16),

                          // Right side week card content
                          Expanded(
                            child: GlassContainer(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Text(
                                    topic,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                  const SizedBox(height: 12),

                                  // Objectives Checklist
                                  const Text(
                                    'Milestone Objectives:',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFF59E0B)),
                                  ),
                                  const SizedBox(height: 6),
                                  ...List.generate(objectives.length, (objIdx) {
                                    final obj = objectives[objIdx];
                                    final key = '${analysisId}_${weekNum}_$objIdx';
                                    final isChecked = _checkpoints[key] ?? false;

                                    return Row(
                                      children: [
                                        Checkbox(
                                          value: isChecked,
                                          activeColor: const Color(0xFFF59E0B),
                                          checkColor: Colors.black,
                                          visualDensity: VisualDensity.compact,
                                          onChanged: (val) {
                                            _toggleCheckpoint(analysisId, weekNum, objIdx, val ?? false);
                                          },
                                        ),
                                        Expanded(
                                          child: Text(
                                            obj.toString(),
                                            style: TextStyle(
                                              fontSize: 12,
                                              decoration: isChecked ? TextDecoration.lineThrough : null,
                                              color: isChecked ? Colors.white.withOpacity(0.4) : Colors.white.withOpacity(0.8),
                                            ),
                                          ),
                                        ),
                                      ],
                                    );
                                  }),

                                  const SizedBox(height: 14),
                                  // Resources lists
                                  if (resources.isNotEmpty) ...[
                                    const Text(
                                      'Suggested Resources:',
                                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Color(0xFFF59E0B)),
                                    ),
                                    const SizedBox(height: 6),
                                    ...resources.map((r) => Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 2),
                                          child: Row(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              const Icon(Icons.link_rounded, size: 14, color: Colors.blueAccent),
                                              const SizedBox(width: 6),
                                              Expanded(
                                                child: Text(
                                                  r.toString(),
                                                  style: const TextStyle(fontSize: 11, color: Colors.blueAccent, decoration: TextDecoration.underline),
                                                ),
                                              ),
                                            ],
                                          ),
                                        )),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _showSwitchRoadmapDialog(List<dynamic> list, CareerProvider provider) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Switch Learning Plan'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.separated(
            shrinkWrap: true,
            itemCount: list.length,
            separatorBuilder: (c, i) => const Divider(),
            itemBuilder: (context, idx) {
              final analysis = list[idx];
              final title = analysis['job_descriptions']?['title'] ?? 'Roadmap';
              final company = analysis['job_descriptions']?['company'] ?? 'Target Role';

              return ListTile(
                title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                subtitle: Text(company, style: const TextStyle(fontSize: 12)),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                onTap: () async {
                  Navigator.pop(ctx);
                  await provider.fetchAnalysisDetails(analysis['id']);
                  _loadPersistedCheckpoints();
                },
              );
            },
          ),
        ),
      ),
    );
  }
}
