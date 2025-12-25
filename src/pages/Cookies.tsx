import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Cookies: React.FC = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {language === 'tr' ? 'Geri' : 'Back'}
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {language === 'tr' ? 'Çerez Politikası' : 'Cookie Policy'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' ? 'Son güncelleme: Aralık 2024' : 'Last updated: December 2024'}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            {language === 'tr' ? (
              <>
                <h2>1. Çerez Nedir?</h2>
                <p>
                  Çerezler, web sitelerinin tarayıcınıza kaydettiği küçük metin dosyalarıdır. 
                  Oturum bilgilerinizi ve tercihlerinizi saklamak için kullanılır.
                </p>

                <h2>2. Kullandığımız Çerezler</h2>
                
                <h3>Zorunlu Çerezler</h3>
                <p>
                  Platformun düzgün çalışması için gereklidir. Oturum yönetimi ve güvenlik 
                  için kullanılır.
                </p>
                <ul>
                  <li><strong>sb-auth-token:</strong> Kimlik doğrulama (7 gün)</li>
                  <li><strong>sb-refresh-token:</strong> Oturum yenileme (30 gün)</li>
                </ul>

                <h3>Tercih Çerezleri</h3>
                <p>Dil tercihinizi ve tema ayarlarınızı saklar.</p>
                <ul>
                  <li><strong>lotastro-language:</strong> Dil tercihi (1 yıl)</li>
                  <li><strong>lotastro-theme:</strong> Tema tercihi (1 yıl)</li>
                </ul>

                <h3>Analitik Çerezler</h3>
                <p>
                  Platform kullanımını analiz etmek için kullanılır. Onayınız olmadan 
                  etkinleştirilmez.
                </p>

                <h2>3. Çerez Yönetimi</h2>
                <p>
                  Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz. 
                  Ancak zorunlu çerezlerin devre dışı bırakılması platformun çalışmasını 
                  engelleyebilir.
                </p>

                <h2>4. İletişim</h2>
                <p>
                  Çerez politikası hakkında sorularınız için: privacy@lotastro.com
                </p>
              </>
            ) : (
              <>
                <h2>1. What are Cookies?</h2>
                <p>
                  Cookies are small text files that websites save to your browser. 
                  They are used to store session information and preferences.
                </p>

                <h2>2. Cookies We Use</h2>
                
                <h3>Essential Cookies</h3>
                <p>
                  Required for the platform to function properly. Used for session 
                  management and security.
                </p>
                <ul>
                  <li><strong>sb-auth-token:</strong> Authentication (7 days)</li>
                  <li><strong>sb-refresh-token:</strong> Session refresh (30 days)</li>
                </ul>

                <h3>Preference Cookies</h3>
                <p>Store your language preference and theme settings.</p>
                <ul>
                  <li><strong>lotastro-language:</strong> Language preference (1 year)</li>
                  <li><strong>lotastro-theme:</strong> Theme preference (1 year)</li>
                </ul>

                <h3>Analytics Cookies</h3>
                <p>
                  Used to analyze platform usage. Not enabled without your consent.
                </p>

                <h2>3. Managing Cookies</h2>
                <p>
                  You can manage or delete cookies through your browser settings. 
                  However, disabling essential cookies may prevent the platform from working.
                </p>

                <h2>4. Contact</h2>
                <p>
                  For cookie policy questions: privacy@lotastro.com
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Cookies;
