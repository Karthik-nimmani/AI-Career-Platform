import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/career_provider.dart';
import '../widgets/glass_container.dart';
import 'settings_screen.dart';
import 'roadmap_screen.dart';

class JobCompareScreen extends StatefulWidget {
  const JobCompareScreen({super.key});

  @override
  State<JobCompareScreen> createState() => _JobCompareScreenState();
}

class _JobCompareScreenState extends State<JobCompareScreen> {
  String? _selectedResumeId;
  final _jdController = TextEditingController();
  final _titleController = TextEditingController();
  final _companyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final careerProvider = Provider.of<CareerProvider>(context, listen: false);
      await careerProvider.fetchResumes();
      await careerProvider.fetchAnalyses();
      if (careerProvider.resumes.isNotEmpty) {
        setState(() {
          _selectedResumeId = careerProvider.resumes.first['id'];
        });
      }
    });
  }

  @override
  void dispose() {
    _jdController.dispose();
    _titleController.dispose();
    _companyController.dispose();
    super.dispose();
  }

  Future<void> _runCompare() async {
    if (_selectedResumeId == null) {
      _showWarning('Please select a resume to compare.');
      return;
    }
    if (_jdController.text.trim().isEmpty) {
      _showWarning('Please paste a target Job Description.');
      return;
    }

    final careerProvider = Provider.of<CareerProvider>(context, listen: false);
    final report = await careerProvider.compareResumeToJob(
      resumeId: _selectedResumeId!,
      jdText: _jdController.text.trim(),
      title: _titleController.text.trim().isNotEmpty ? _titleController.text.trim() : null,
      company: _companyController.text.trim().isNotEmpty ? _companyController.text.trim() : null,
    );

    if (!mounted) return;

    if (report != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('ATS Match Completed!'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (careerProvider.errorMessage != null) {
      _handleAPIError(careerProvider.errorMessage!);
      careerProvider.clearError();
    }
  }

  Future<void> _generateRoadmap(String analysisId) async {
    final careerProvider = Provider.of<CareerProvider>(context, listen: false);
    final success = await careerProvider.generateLearningRoadmap(analysisId);

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Learning roadmap compiled successfully!'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const RoadmapScreen()),
      );
    } else if (careerProvider.errorMessage != null) {
      _handleAPIError(careerProvider.errorMessage!);
      careerProvider.clearError();
    }
  }

  void _showWarning(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.orangeAccent,
      ),
    );
  }

  void _handleAPIError(String error) {
    // If we receive a missing key API exception, show an easy navigation prompt
    if (error.contains('Missing') && error.contains('API Key')) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('API Keys Required'),
          content: Text(error),
          actions: [
            TextButton(
              child: const Text('Cancel'),
              onPressed: () => Navigator.pop(ctx),
            ),
            TextButton(
              child: const Text('Add Key Now', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF6366F1))),
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
    final activeAnalysis = careerProvider.activeAnalysis;

    return Scaffold(
      appBar: AppBar(
        title: const Text('ATS Job Comparison'),
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
      ),
      body: careerProvider.analysesLoading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                  ),
                  SizedBox(height: 16),
                  Text('Analyzing resume alignment against JD...', style: TextStyle(fontWeight: FontWeight.w500)),
                ],
              ),
            )
          : activeAnalysis == null
              ? _buildComparisonForm(careerProvider)
              : _buildAnalysisReport(activeAnalysis, careerProvider),
    );
  }

  Widget _buildComparisonForm(CareerProvider provider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Select Profile Resume',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),

          // Resume dropdown selector
          provider.resumes.isEmpty
              ? GlassContainer(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: TextButton(
                      child: const Text('No Resumes - Click to upload profile', style: TextStyle(color: Color(0xFF6366F1))),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                )
              : Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF141320).withOpacity(0.65),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.08)),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedResumeId,
                      dropdownColor: const Color(0xFF141320),
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                      isExpanded: true,
                      items: provider.resumes.map<DropdownMenuItem<String>>((res) {
                        final parsed = res['parsed_content'] ?? {};
                        final name = parsed['personal_info']?['name'] ?? 'Parsed Resume';
                        return DropdownMenuItem<String>(
                          value: res['id'],
                          child: Text(name),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setState(() {
                          _selectedResumeId = val;
                        });
                      },
                    ),
                  ),
                ),
          const SizedBox(height: 20),

          const Text(
            'Job Details (Optional)',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _titleController,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Job Title',
                    labelStyle: TextStyle(color: Colors.white.withOpacity(0.4)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    enabledBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFF6366F1)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _companyController,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    labelText: 'Company',
                    labelStyle: TextStyle(color: Colors.white.withOpacity(0.4)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    enabledBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFF6366F1)),
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          const Text(
            'Target Job Description',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _jdController,
            maxLines: 8,
            style: const TextStyle(fontSize: 13, height: 1.4),
            decoration: InputDecoration(
              hintText: 'Paste the complete job description details here...',
              hintStyle: TextStyle(color: Colors.white.withOpacity(0.3)),
              contentPadding: const EdgeInsets.all(16),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.white.withOpacity(0.08)),
                borderRadius: BorderRadius.circular(12),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: const BorderSide(color: Color(0xFF6366F1)),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 28),

          ElevatedButton.icon(
            onPressed: _runCompare,
            icon: const Icon(Icons.rocket_launch_rounded),
            label: const Text('Execute ATS Matching'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF6366F1),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 28),
          const Text(
            'Your Saved Analyses',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          provider.analyses.isEmpty
              ? GlassContainer(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'No analyses run yet',
                      style: TextStyle(color: Colors.white.withOpacity(0.4)),
                    ),
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: provider.analyses.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final analysis = provider.analyses[index];
                    final matchPct = analysis['match_percentage'] ?? 0;
                    final atsScore = analysis['ats_score'] ?? 0;
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
                                color: const Color(0xFF6366F1).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.analytics_outlined, color: Color(0xFF6366F1)),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Report #${analysis['id'].toString().substring(0, 8)}', 
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Match: $matchPct% | ATS: $atsScore • $dateStr',
                                    style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 20),
                              onPressed: () async {
                                final confirm = await showDialog<bool>(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    title: const Text('Delete Match Report'),
                                    content: const Text('Are you sure you want to delete this comparison report? This will also remove any cached study roadmap.'),
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
                                  await provider.deleteAnalysis(analysis['id']);
                                }
                              },
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
    );
  }

  Widget _buildAnalysisReport(Map<String, dynamic> report, CareerProvider provider) {
    final int matchPct = report['match_percentage'] ?? 0;
    final int atsScore = report['ats_score'] ?? 0;
    final int vectorScore = report['vector_score'] ?? 0;

    final gaps = report['skill_gaps'] ?? {};
    final List<dynamic> matchedSkills = gaps['matched_skills'] ?? [];
    final List<dynamic> missingSkills = gaps['missing_skills'] ?? [];
    final String explanation = gaps['explanation'] ?? '';

    final List<dynamic> suggestions = report['improvement_suggestions'] ?? [];
    final bool hasRoadmap = report['roadmap'] != null;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header Back Row
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () {
                  setState(() {
                    provider.fetchAnalyses();
                  });
                  _jdController.clear();
                  provider.fetchAnalyses();
                },
              ),
              const SizedBox(width: 8),
              const Text(
                'Comparison Report',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                tooltip: 'Delete Report',
                onPressed: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Delete Match Report'),
                      content: const Text('Are you sure you want to delete this comparison report? This will also remove any cached study roadmap.'),
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
                    final success = await provider.deleteAnalysis(report['id']);
                    if (success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Match report deleted successfully.'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    }
                  }
                },
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Scores Row
          Row(
            children: [
              Expanded(
                child: _buildMetricGauge(
                  label: 'Overall Match',
                  value: '$matchPct%',
                  color: const Color(0xFF6366F1),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricGauge(
                  label: 'ATS Alignment',
                  value: '$atsScore/100',
                  color: const Color(0xFF10B981),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildMetricGauge(
                  label: 'Semantic Match',
                  value: '$vectorScore/100',
                  color: const Color(0xFF8B5CF6),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Explanation section
          const Text('ATS Evaluation Summary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          GlassContainer(
            child: Text(
              explanation.isNotEmpty ? explanation : 'Analysis complete.',
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
          ),
          const SizedBox(height: 24),

          // Roadmap generation banner
          if (missingSkills.isNotEmpty) ...[
            GlassContainer(
              backgroundColor: const Color(0xFFF59E0B).withOpacity(0.08),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.orangeAccent, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Skills Gaps Isolated',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.orangeAccent),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'We isolated ${missingSkills.length} missing skill gaps. Compile an AI learning roadmap to close these gaps.',
                    style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12),
                  ),
                  const SizedBox(height: 14),
                  provider.roadmapLoading
                      ? const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.orangeAccent),
                          ),
                        )
                      : ElevatedButton.icon(
                          onPressed: () => _generateRoadmap(report['id']),
                          icon: const Icon(Icons.route_rounded),
                          label: Text(hasRoadmap ? 'View Learning Roadmap' : 'Generate Learning Roadmap'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.orangeAccent.withOpacity(0.2),
                            foregroundColor: Colors.orangeAccent,
                            elevation: 0,
                            side: const BorderSide(color: Colors.orangeAccent, width: 0.5),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                ],
              ),
            ),
            const SizedBox(height: 24),
          ],

          // Missing Skills (Gaps) list
          if (missingSkills.isNotEmpty) ...[
            const Text('Isolated Gaps (Missing Skills)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 10,
              children: missingSkills.map((skill) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: Colors.redAccent.withOpacity(0.25)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.remove_circle_outline_rounded, size: 14, color: Colors.redAccent),
                      const SizedBox(width: 6),
                      Text(
                        skill.toString(),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.redAccent),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
          ],

          // Matched Skills list
          if (matchedSkills.isNotEmpty) ...[
            const Text('Matched Skills', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 10,
              children: matchedSkills.map((skill) {
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(color: Colors.greenAccent.withOpacity(0.25)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, size: 14, color: Colors.greenAccent),
                      const SizedBox(width: 6),
                      Text(
                        skill.toString(),
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.greenAccent),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 24),
          ],

          // Improvement Suggestions
          if (suggestions.isNotEmpty) ...[
            const Text('Improvement Suggestions', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 10),
            GlassContainer(
              child: Column(
                children: suggestions.map((s) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6.0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.arrow_right_alt_rounded, color: Color(0xFF6366F1), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            s.toString(),
                            style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.8), height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetricGauge({
    required String label,
    required String value,
    required Color color,
  }) {
    return GlassContainer(
      padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 10),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withOpacity(0.4),
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
