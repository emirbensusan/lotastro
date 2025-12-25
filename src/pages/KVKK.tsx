import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const KVKK: React.FC = () => {
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
              {language === 'tr' ? 'KVKK Aydınlatma Metni' : 'KVKK Information Notice'}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {language === 'tr' 
                ? '6698 Sayılı Kişisel Verilerin Korunması Kanunu' 
                : 'Law No. 6698 on Protection of Personal Data'}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            {language === 'tr' ? (
              <>
                <h2>1. Veri Sorumlusu</h2>
                <p>
                  6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, 
                  kişisel verileriniz; veri sorumlusu olarak LotAstro tarafından aşağıda 
                  açıklanan kapsamda işlenebilecektir.
                </p>

                <h2>2. İşlenen Kişisel Veriler</h2>
                <ul>
                  <li><strong>Kimlik Bilgileri:</strong> Ad, soyad</li>
                  <li><strong>İletişim Bilgileri:</strong> E-posta adresi, telefon numarası</li>
                  <li><strong>İşlem Güvenliği Bilgileri:</strong> IP adresi, log kayıtları</li>
                  <li><strong>Mesleki Bilgiler:</strong> Şirket adı, görev unvanı</li>
                </ul>

                <h2>3. Kişisel Verilerin İşlenme Amaçları</h2>
                <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
                <ul>
                  <li>Hizmet sunumu ve sözleşme yükümlülüklerinin yerine getirilmesi</li>
                  <li>Müşteri ilişkileri yönetimi</li>
                  <li>Bilgi güvenliği süreçlerinin yürütülmesi</li>
                  <li>Yasal yükümlülüklerin yerine getirilmesi</li>
                  <li>İş süreçlerinin iyileştirilmesi</li>
                </ul>

                <h2>4. Kişisel Verilerin Aktarılması</h2>
                <p>
                  Kişisel verileriniz, KVKK'nın 8. ve 9. maddeleri kapsamında belirtilen 
                  şartlara uygun olarak:
                </p>
                <ul>
                  <li>Yasal zorunluluk halinde yetkili kamu kurum ve kuruluşlarına</li>
                  <li>Hizmet sağlayıcılarımıza (hosting, e-posta hizmetleri)</li>
                </ul>
                <p>aktarılabilmektedir.</p>

                <h2>5. Kişisel Veri Toplamanın Yöntemi ve Hukuki Sebebi</h2>
                <p>
                  Kişisel verileriniz, elektronik ortamda web sitesi ve platform üzerinden 
                  toplanmaktadır. Hukuki sebep olarak:
                </p>
                <ul>
                  <li>Sözleşmenin kurulması ve ifası</li>
                  <li>Meşru menfaat</li>
                  <li>Yasal yükümlülük</li>
                </ul>

                <h2>6. KVKK Kapsamındaki Haklarınız</h2>
                <p>KVKK'nın 11. maddesi uyarınca sahip olduğunuz haklar:</p>
                <ul>
                  <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                  <li>İşlenmişse buna ilişkin bilgi talep etme</li>
                  <li>İşlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                  <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
                  <li>Eksik veya yanlış işlenmiş olması hâlinde düzeltilmesini isteme</li>
                  <li>KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
                  <li>Düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme</li>
                  <li>İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi 
                      suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
                  <li>Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
                </ul>

                <h2>7. Başvuru</h2>
                <p>
                  Yukarıda belirtilen haklarınızı kullanmak için kvkk@lotastro.com adresine 
                  e-posta gönderebilirsiniz.
                </p>
              </>
            ) : (
              <>
                <h2>1. Data Controller</h2>
                <p>
                  In accordance with Law No. 6698 on the Protection of Personal Data ("KVKK"), 
                  your personal data may be processed by LotAstro as the data controller 
                  within the scope explained below.
                </p>

                <h2>2. Personal Data Processed</h2>
                <ul>
                  <li><strong>Identity Information:</strong> Name, surname</li>
                  <li><strong>Contact Information:</strong> Email address, phone number</li>
                  <li><strong>Transaction Security Information:</strong> IP address, log records</li>
                  <li><strong>Professional Information:</strong> Company name, job title</li>
                </ul>

                <h2>3. Purposes of Processing Personal Data</h2>
                <p>Your personal data is processed for the following purposes:</p>
                <ul>
                  <li>Service provision and fulfillment of contractual obligations</li>
                  <li>Customer relationship management</li>
                  <li>Information security processes</li>
                  <li>Compliance with legal obligations</li>
                  <li>Improvement of business processes</li>
                </ul>

                <h2>4. Transfer of Personal Data</h2>
                <p>
                  Your personal data may be transferred in accordance with Articles 8 and 9 
                  of KVKK to:
                </p>
                <ul>
                  <li>Authorized public institutions when legally required</li>
                  <li>Our service providers (hosting, email services)</li>
                </ul>

                <h2>5. Method and Legal Basis for Data Collection</h2>
                <p>
                  Your personal data is collected electronically through the website and platform. 
                  Legal bases include:
                </p>
                <ul>
                  <li>Establishment and performance of contract</li>
                  <li>Legitimate interest</li>
                  <li>Legal obligation</li>
                </ul>

                <h2>6. Your Rights Under KVKK</h2>
                <p>Your rights under Article 11 of KVKK:</p>
                <ul>
                  <li>Learn whether your personal data is processed</li>
                  <li>Request information if processed</li>
                  <li>Learn the purpose of processing and whether data is used accordingly</li>
                  <li>Know third parties to whom data is transferred domestically or abroad</li>
                  <li>Request correction if data is incomplete or incorrectly processed</li>
                  <li>Request deletion under conditions in Article 7 of KVKK</li>
                  <li>Request notification of corrections/deletions to third parties</li>
                  <li>Object to adverse results from automated analysis</li>
                  <li>Claim damages if harmed by unlawful processing</li>
                </ul>

                <h2>7. Application</h2>
                <p>
                  To exercise your rights, please email kvkk@lotastro.com
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KVKK;
