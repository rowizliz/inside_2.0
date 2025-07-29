import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import supabase from '../supabase';

export default function ProfileMigration() {
  const [migrating, setMigrating] = useState(false);
  const [result, setResult] = useState('');
  const { currentUser } = useAuth();

  const migrateProfile = async () => {
    if (!currentUser) return;

    setMigrating(true);
    setResult('Đang migrate profile...');

    try {
      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        setResult(`❌ Lỗi kiểm tra profile: ${checkError.message}`);
        return;
      }

      if (existingProfile) {
        setResult('✅ Profile đã tồn tại, không cần migrate');
        return;
      }

      // Create profile for current user
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: currentUser.id,
          display_name: currentUser.displayName || currentUser.email,
          bio: '',
          avatar_url: null
        });

      if (insertError) {
        setResult(`❌ Lỗi tạo profile: ${insertError.message}`);
        return;
      }

      setResult('✅ Đã migrate profile thành công! Hãy refresh trang.');
    } catch (error) {
      setResult(`❌ Lỗi migrate: ${error.message}`);
    }

    setMigrating(false);
  };

  if (!currentUser) return null;

  return (
    <div className="p-4 border border-yellow-600 rounded-lg mb-4">
      <h3 className="text-white font-semibold mb-2">Migrate Profile</h3>
      <p className="text-yellow-400 text-sm mb-2">
        Nếu profile chưa được tạo, hãy click nút bên dưới để migrate.
      </p>
      <button
        onClick={migrateProfile}
        disabled={migrating}
        className="bg-yellow-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {migrating ? 'Đang migrate...' : 'Migrate Profile'}
      </button>
      {result && (
        <pre className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  );
} 