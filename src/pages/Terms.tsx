import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms: React.FC = () => {
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
              {language === 'tr' ? 'Kullanım Koşulları' : 'Terms of Service'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' ? 'Son güncelleme: Aralık 2024' : 'Last updated: December 2024'}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            {language === 'tr' ? (
              <>
                <h2>1. Kabul Edilen Koşullar</h2>
                <p>
                  LotAstro hizmetlerini kullanarak, bu kullanım koşullarını kabul etmiş olursunuz. 
                  Bu koşulları kabul etmiyorsanız, lütfen hizmetlerimizi kullanmayın.
                </p>

                <h2>2. Hizmet Tanımı</h2>
                <p>
                  LotAstro, tekstil endüstrisi için envanter yönetimi, sipariş takibi ve tedarik zinciri 
                  optimizasyonu hizmetleri sunan bir B2B SaaS platformudur.
                </p>

                <h2>3. Kullanıcı Hesapları</h2>
                <p>
                  Hizmetlerimizi kullanmak için bir hesap oluşturmanız gerekmektedir. Hesap bilgilerinizin 
                  gizliliğinden ve güvenliğinden siz sorumlusunuz.
                </p>

                <h2>4. Kullanım Kuralları</h2>
                <ul>
                  <li>Yasalara uygun şekilde kullanım</li>
                  <li>Üçüncü tarafların haklarına saygı</li>
                  <li>Sistemin güvenliğini tehlikeye atacak eylemlerden kaçınma</li>
                  <li>Doğru ve güncel bilgi sağlama</li>
                </ul>

                <h2>5. Veri Güvenliği</h2>
                <p>
                  Verilerinizin güvenliği bizim için önemlidir. Tüm veriler endüstri standardı 
                  şifreleme ile korunmaktadır.
                </p>

                <h2>6. Sorumluluk Sınırlaması</h2>
                <p>
                  LotAstro, hizmet kesintileri veya veri kayıplarından kaynaklanan dolaylı 
                  zararlardan sorumlu tutulamaz.
                </p>

                <h2>7. Değişiklikler</h2>
                <p>
                  Bu koşulları herhangi bir zamanda değiştirme hakkımızı saklı tutarız. 
                  Değişiklikler yayınlandığı anda yürürlüğe girer.
                </p>

                <h2>8. İletişim</h2>
                <p>
                  Sorularınız için: support@lotastro.com
                </p>
              </>
            ) : (
              <>
                <h2>1. Acceptance of Terms</h2>
                <p>
                  By using LotAstro services, you agree to these terms of service. 
                  If you do not agree to these terms, please do not use our services.
                </p>

                <h2>2. Service Description</h2>
                <p>
                  LotAstro is a B2B SaaS platform providing inventory management, order tracking, 
                  and supply chain optimization services for the textile industry.
                </p>

                <h2>3. User Accounts</h2>
                <p>
                  You must create an account to use our services. You are responsible for 
                  maintaining the confidentiality and security of your account information.
                </p>

                <h2>4. Usage Rules</h2>
                <ul>
                  <li>Use in compliance with applicable laws</li>
                  <li>Respect the rights of third parties</li>
                  <li>Avoid actions that may compromise system security</li>
                  <li>Provide accurate and up-to-date information</li>
                </ul>

                <h2>5. Data Security</h2>
                <p>
                  Your data security is important to us. All data is protected with 
                  industry-standard encryption.
                </p>

                <h2>6. Limitation of Liability</h2>
                <p>
                  LotAstro shall not be held liable for indirect damages arising from 
                  service interruptions or data loss.
                </p>

                <h2>7. Modifications</h2>
                <p>
                  We reserve the right to modify these terms at any time. 
                  Changes become effective upon publication.
                </p>

                <h2>8. Contact</h2>
                <p>
                  For questions: support@lotastro.com
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
