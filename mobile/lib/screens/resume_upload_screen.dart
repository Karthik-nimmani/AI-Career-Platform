import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import '../services/career_provider.dart';
import '../widgets/glass_container.dart';

class ResumeUploadScreen extends StatefulWidget {
  final String? viewingResumeId;

  const ResumeUploadScreen({super.key, this.viewingResumeId});

  @override
  State<ResumeUploadScreen> createState() => _ResumeUploadScreenState();
}

class _ResumeUploadScreenState extends State<ResumeUploadScreen> with SingleTickerProviderStateMixin {
  TabController? _tabController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final careerProvider = Provider.of<CareerProvider>(context, listen: false);
      if (widget.viewingResumeId != null) {
        await careerProvider.selectResume(widget.viewingResumeId!);
        _setupTabController();
      } else {
        await careerProvider.fetchResumes();
      }
    });
  }

  void _setupTabController() {
    setState(() {
      _tabController = TabController(length: 4, vsync: this);
    });
  }

  @override
  void dispose() {
    _tabController?.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadFile() async {
    final careerProvider = Provider.of<CareerProvider>(context, listen: false);

    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );

      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      Uint8List? fileBytes = file.bytes;

      // On some platforms (Android/iOS), bytes can be null, read from path
      if (fileBytes == null && file.path != null) {
        final localFile = File(file.path!);
        fileBytes = await localFile.readAsBytes();
      }

      if (fileBytes == null) {
        _showError('Could not read file data. Please try again.');
        return;
      }

      final success = await careerProvider.uploadResumeFile(fileBytes, file.name);

      if (!mounted) return;

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Resume uploaded and parsed successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        // Load the newly uploaded/parsed resume details
        if (careerProvider.resumes.isNotEmpty) {
          final newResumeId = careerProvider.resumes.first['id'];
          await careerProvider.selectResume(newResumeId);
          _setupTabController();
        }
      } else if (careerProvider.errorMessage != null) {
        _showError(careerProvider.errorMessage!);
        careerProvider.clearError();
      }
    } catch (e) {
      _showError('Failed to pick file: $e');
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
    final selectedResume = careerProvider.selectedResume;
    final parsedContent = selectedResume != null ? selectedResume['parsed_content'] : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.viewingResumeId != null ? 'Resume Details' : 'Resume Workspace'),
        backgroundColor: const Color(0xFF08070D),
        elevation: 0,
        actions: [
          if (widget.viewingResumeId == null)
            IconButton(
              icon: const Icon(Icons.upload_file_rounded),
              tooltip: 'Upload New',
              onPressed: _pickAndUploadFile,
            ),
        ],
      ),
      body: careerProvider.resumesLoading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF6366F1)),
                  ),
                  SizedBox(height: 16),
                  Text('Uploading and parsing resume with AI...'),
                ],
              ),
            )
          : selectedResume == null
              ? _buildResumeSelector(careerProvider)
              : _buildParsedResumeView(parsedContent),
    );
  }

  Widget _buildResumeSelector(CareerProvider provider) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Upload Area Card
          GestureDetector(
            onTap: _pickAndUploadFile,
            child: GlassContainer(
              padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF6366F1).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.cloud_upload_outlined,
                      size: 40,
                      color: Color(0xFF6366F1),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Upload Your Resume PDF',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'File formats: PDF only (max 10MB)',
                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _pickAndUploadFile,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Browse Files', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 28),

          const Text(
            'Your Saved Resumes',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),

          provider.resumes.isEmpty
              ? GlassContainer(
                  padding: const EdgeInsets.symmetric(vertical: 24),
                  child: Center(
                    child: Text(
                      'No resumes uploaded yet',
                      style: TextStyle(color: Colors.white.withOpacity(0.4)),
                    ),
                  ),
                )
              : ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: provider.resumes.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final res = provider.resumes[index];
                    final parsed = res['parsed_content'] ?? {};
                    final name = parsed['personal_info']?['name'] ?? 'Parsed Resume';
                    final role = parsed['personal_info']?['title'] ?? 'Extracted Profile';

                    return GestureDetector(
                      onTap: () async {
                        await provider.selectResume(res['id']);
                        _setupTabController();
                      },
                      child: GlassContainer(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFF6366F1).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.picture_as_pdf_outlined, color: Color(0xFF6366F1)),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                  const SizedBox(height: 2),
                                  Text(
                                    role,
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
                                    title: const Text('Delete Resume'),
                                    content: const Text('Are you sure you want to delete this resume? This will also purge its vector indices.'),
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
                                  await provider.deleteResume(res['id']);
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

  Widget _buildParsedResumeView(Map<String, dynamic>? parsedContent) {
    if (parsedContent == null || _tabController == null) {
      return const Center(
        child: Text('Invalid parsed content layout.'),
      );
    }

    final personalInfo = parsedContent['personal_info'] ?? {};
    final name = personalInfo['name'] ?? 'No Name';
    final role = personalInfo['title'] ?? 'No Role';
    final summary = personalInfo['summary'] ?? '';

    final List<dynamic> experienceList = parsedContent['experience'] ?? [];
    final List<dynamic> educationList = parsedContent['education'] ?? [];
    final List<dynamic> skillsList = parsedContent['skills'] ?? [];

    return Column(
      children: [
        // Resume Header details
        Container(
          padding: const EdgeInsets.all(20),
          color: const Color(0xFF141320).withOpacity(0.3),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () {
                  setState(() {
                    _tabController = null;
                  });
                  Provider.of<CareerProvider>(context, listen: false).fetchResumes();
                },
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      role,
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent),
                tooltip: 'Delete Resume',
                onPressed: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Delete Resume'),
                      content: const Text('Are you sure you want to delete this resume? This will also purge its vector indices.'),
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
                    final success = await Provider.of<CareerProvider>(context, listen: false).deleteResume(selectedResume['id']);
                    if (success && mounted) {
                      setState(() {
                        _tabController = null;
                      });
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Resume deleted successfully.'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    }
                  }
                },
              ),
            ],
          ),
        ),

        // Tabs
        TabBar(
          controller: _tabController,
          indicatorColor: const Color(0xFF6366F1),
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white.withOpacity(0.4),
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Experience'),
            Tab(text: 'Education'),
            Tab(text: 'Skills'),
          ],
        ),

        // Tab views
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              // 1. Overview Tab
              SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Professional Summary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 12),
                    GlassContainer(
                      child: Text(
                        summary.isNotEmpty ? summary : 'No summary provided.',
                        style: const TextStyle(fontSize: 14, height: 1.5),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text('Contact Information', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const SizedBox(height: 12),
                    GlassContainer(
                      child: Column(
                        children: [
                          _buildContactRow(Icons.email_outlined, personalInfo['email'] ?? 'N/A'),
                          const Divider(color: Colors.white10),
                          _buildContactRow(Icons.phone_outlined, personalInfo['phone'] ?? 'N/A'),
                          const Divider(color: Colors.white10),
                          _buildContactRow(Icons.location_on_outlined, personalInfo['location'] ?? 'N/A'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // 2. Experience Tab
              experienceList.isEmpty
                  ? const Center(child: Text('No work experience listed.'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: experienceList.length,
                      itemBuilder: (context, index) {
                        final exp = experienceList[index];
                        final resp = exp['responsibilities'] as List<dynamic>? ?? [];

                        return GlassContainer(
                          margin: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      exp['title'] ?? 'Title',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF6366F1)),
                                    ),
                                  ),
                                  Text(
                                    exp['period'] ?? '',
                                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                exp['company'] ?? 'Company',
                                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                              ),
                              const SizedBox(height: 12),
                              if (resp.isNotEmpty) ...[
                                const Text('Key Responsibilities:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                                const SizedBox(height: 6),
                                ...resp.map((r) => Padding(
                                      padding: const EdgeInsets.only(bottom: 4.0),
                                      child: Row(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text('• ', style: TextStyle(color: Color(0xFF6366F1), fontWeight: FontWeight.bold)),
                                          Expanded(
                                            child: Text(
                                              r.toString(),
                                              style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.7), height: 1.4),
                                            ),
                                          ),
                                        ],
                                      ),
                                    )),
                              ],
                            ],
                          ),
                        );
                      },
                    ),

              // 3. Education Tab
              educationList.isEmpty
                  ? const Center(child: Text('No education listed.'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: educationList.length,
                      itemBuilder: (context, index) {
                        final edu = educationList[index];

                        return GlassContainer(
                          margin: const EdgeInsets.only(bottom: 16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      edu['degree'] ?? 'Degree',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF6366F1)),
                                    ),
                                  ),
                                  Text(
                                    edu['period'] ?? '',
                                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                edu['institution'] ?? 'Institution',
                                style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                              ),
                              if (edu['details'] != null && edu['details'].toString().isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text(
                                  edu['details'].toString(),
                                  style: TextStyle(fontSize: 12, color: Colors.white.withOpacity(0.6)),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),

              // 4. Skills Tab
              skillsList.isEmpty
                  ? const Center(child: Text('No skills extracted.'))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 10,
                        children: skillsList.map((skill) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF6366F1).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFF6366F1).withOpacity(0.25)),
                            ),
                            child: Text(
                              skill.toString(),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          );
                        }).toList(),
                      ),
                    ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildContactRow(IconData icon, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF6366F1)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}
