import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy: React.FC = () => {
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
              {language === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' ? 'Son güncelleme: Aralık 2024' : 'Last updated: December 2024'}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            {language === 'tr' ? (
              <>
                <h2>1. Toplanan Veriler</h2>
                <p>LotAstro olarak aşağıdaki verileri topluyoruz:</p>
                <ul>
                  <li><strong>Hesap Bilgileri:</strong> Ad, e-posta adresi, şirket adı</li>
                  <li><strong>Kullanım Verileri:</strong> Platform kullanım istatistikleri, oturum bilgileri</li>
                  <li><strong>İş Verileri:</strong> Envanter kayıtları, sipariş bilgileri, tedarikçi verileri</li>
                </ul>

                <h2>2. Verilerin Kullanımı</h2>
                <p>Verilerinizi şu amaçlarla kullanıyoruz:</p>
                <ul>
                  <li>Hizmetlerimizi sunmak ve iyileştirmek</li>
                  <li>Teknik destek sağlamak</li>
                  <li>Güvenlik önlemleri almak</li>
                  <li>Yasal yükümlülüklerimizi yerine getirmek</li>
                </ul>

                <h2>3. Veri Paylaşımı</h2>
                <p>
                  Verilerinizi üçüncü taraflarla paylaşmıyoruz, ancak yasal zorunluluk durumlarında 
                  yetkili makamlarla paylaşım yapılabilir.
                </p>

                <h2>4. Veri Güvenliği</h2>
                <p>
                  Verileriniz SSL/TLS şifreleme ile korunmaktadır. Sunucularımız AB veri merkezlerinde 
                  barındırılmaktadır.
                </p>

                <h2>5. Veri Saklama</h2>
                <p>
                  Verileriniz hesabınız aktif olduğu sürece saklanır. Hesap kapanışından sonra 
                  veriler 90 gün içinde silinir.
                </p>

                <h2>6. Haklarınız</h2>
                <p>KVKK kapsamında şu haklara sahipsiniz:</p>
                <ul>
                  <li>Verilerinize erişim hakkı</li>
                  <li>Düzeltme talep etme hakkı</li>
                  <li>Silme talep etme hakkı</li>
                  <li>Veri taşınabilirliği hakkı</li>
                </ul>

                <h2>7. İletişim</h2>
                <p>
                  Gizlilik sorularınız için: privacy@lotastro.com
                </p>
              </>
            ) : (
              <>
                <h2>1. Data We Collect</h2>
                <p>LotAstro collects the following data:</p>
                <ul>
                  <li><strong>Account Information:</strong> Name, email address, company name</li>
                  <li><strong>Usage Data:</strong> Platform usage statistics, session information</li>
                  <li><strong>Business Data:</strong> Inventory records, order information, supplier data</li>
                </ul>

                <h2>2. How We Use Data</h2>
                <p>We use your data to:</p>
                <ul>
                  <li>Provide and improve our services</li>
                  <li>Provide technical support</li>
                  <li>Implement security measures</li>
                  <li>Comply with legal obligations</li>
                </ul>

                <h2>3. Data Sharing</h2>
                <p>
                  We do not share your data with third parties, except when required by law 
                  with authorized authorities.
                </p>

                <h2>4. Data Security</h2>
                <p>
                  Your data is protected with SSL/TLS encryption. Our servers are hosted 
                  in EU data centers.
                </p>

                <h2>5. Data Retention</h2>
                <p>
                  Your data is retained while your account is active. After account closure, 
                  data is deleted within 90 days.
                </p>

                <h2>6. Your Rights</h2>
                <p>Under GDPR, you have the following rights:</p>
                <ul>
                  <li>Right to access your data</li>
                  <li>Right to request correction</li>
                  <li>Right to request deletion</li>
                  <li>Right to data portability</li>
                </ul>

                <h2>7. Contact</h2>
                <p>
                  For privacy questions: privacy@lotastro.com
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacy;
