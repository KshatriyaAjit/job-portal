"use client";

import { useState } from "react";
import { User, Mail, Edit2, Plus, Github, Linkedin, FileText } from "lucide-react";
import ProfileForm from "./ProfileForm";

interface Props {
  profile: any; // The profile data from DB
  userId: string;
  userEmail: string;
}

export default function ProfileWrapper({ profile, userId, userEmail }: Props) {
  // Logic: If no profile exists, show the "Empty" state which prompts to edit
  const [isEditing, setIsEditing] = useState(false);

  // 1. EDIT MODE
  if (isEditing) {
    return (
      <ProfileForm 
        initialData={profile || { email: userEmail }} 
        userId={userId} 
        onSuccess={() => setIsEditing(false)} // Go back to View/Card
        onCancel={() => setIsEditing(false)} 
      />
    );
  }

  // 2. EMPTY STATE (New User with no bio)
  if (!profile || !profile.bio) {
    return (
      <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center shadow-sm">
        <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <User className="text-blue-600 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Build Your Candidate Profile</h2>
        <p className="text-gray-500 mt-2 mb-8 max-w-md mx-auto">
          Create a profile once to enable "Quick Apply" for thousands of jobs. Add your bio, skills, and resume.
        </p>
        <button 
          onClick={() => setIsEditing(true)}
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold hover:bg-blue-700 transition flex items-center gap-2 mx-auto"
        >
          <Plus className="w-5 h-5" />
          Create My Profile
        </button>
      </div>
    );
  }

  // 3. VIEW MODE (Profile Card)
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-2xl font-bold">
              {userEmail.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Profile</h1>
            <div className="flex items-center gap-2 text-blue-100 text-sm mt-1">
              <Mail className="w-4 h-4" /> {profile.email || userEmail}
            </div>
          </div>
        </div>
        <button 
          onClick={() => setIsEditing(true)}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition"
        >
          <Edit2 className="w-4 h-4" /> Edit Details
        </button>
      </div>

      {/* Body */}
      <div className="p-8 space-y-8">
        
        {/* Bio */}
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">About Me</h3>
          <p className="text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100">
            {profile.bio}
          </p>
        </div>

        {/* Skills */}
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Skills</h3>
          <div className="flex flex-wrap gap-2">
            {profile.skills && profile.skills.length > 0 ? (
              profile.skills.map((skill: string, index: number) => (
                <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                  {skill}
                </span>
              ))
            ) : (
              <p className="text-gray-400 italic">No skills listed.</p>
            )}
          </div>
        </div>

        {/* Links & Resume */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
          
          {/* Socials */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Social Links</h3>
            {profile.linkedin ? (
              <a href={profile.linkedin} target="_blank" className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition p-3 rounded-lg border border-gray-200 hover:border-blue-300">
                <Linkedin className="w-5 h-5 text-blue-600" /> LinkedIn Profile
              </a>
            ) : <p className="text-sm text-gray-400">No LinkedIn added</p>}

            {profile.github ? (
              <a href={profile.github} target="_blank" className="flex items-center gap-3 text-gray-700 hover:text-black transition p-3 rounded-lg border border-gray-200 hover:border-gray-400">
                <Github className="w-5 h-5" /> GitHub Profile
              </a>
            ) : <p className="text-sm text-gray-400">No GitHub added</p>}
          </div>

          {/* Resume */}
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Default Resume</h3>
            {profile.resumeUrl ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white p-2 rounded-lg text-green-600 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-green-900 text-sm">Resume.pdf</p>
                    <p className="text-green-600 text-xs">Ready for Quick Apply</p>
                  </div>
                </div>
                <a 
                  href={profile.resumeUrl} 
                  target="_blank" 
                  className="text-green-700 font-bold text-sm hover:underline"
                >
                  View
                </a>
              </div>
            ) : (
              <p className="text-gray-400 italic">No resume uploaded.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}