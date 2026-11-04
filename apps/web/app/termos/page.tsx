import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = { title: 'Termos de Uso e Serviço | Rastrewin' };

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Aceitando os Termos',
    body: [
      'Ao navegar e usar o site da Rastrewin, você concorda automaticamente com nossas regras e condições. Estamos sempre procurando melhorar, então esses termos podem mudar de vez em quando. Se fizermos alterações significativas, vamos postar as atualizações aqui no site. Continuar usando o site após essas mudanças significa que você aceita os novos termos.',
    ],
  },
  {
    title: '2. Como Usar o Nosso Site',
    body: [
      'A maior parte do nosso site está aberta para você sem a necessidade de cadastro. No entanto, algumas seções especiais podem exigir que você crie uma conta. Pedimos que você seja honesto ao fornecer suas informações e que mantenha sua senha e login seguros. Se decidir compartilhar algum conteúdo conosco, como comentários, por favor, faça-o de maneira respeitosa e dentro da lei.',
    ],
  },
  {
    title: '3. Sua Privacidade',
    body: [
      'Na Rastrewin, a privacidade é um valor essencial. Ao interagir com nosso site, você aceita nossa Política de Privacidade (disponível em /privacidade), que detalha nossa abordagem responsável e conforme às leis para o manejo dos seus dados pessoais. Nosso compromisso é com a transparência e a segurança: explicamos como coletamos, usamos e protegemos suas informações, garantindo sua privacidade e oferecendo controle sobre seus dados.',
      'Adotamos práticas de segurança para proteger suas informações contra acesso não autorizado e compartilhamento indevido, assegurando que qualquer cooperação com terceiros ocorra apenas com base na sua aprovação ou exigências legais claras, reafirmando nosso comprometimento com a sua confiança e segurança digital.',
    ],
  },
  {
    title: '4. Direitos de Conteúdo',
    body: [
      'O conteúdo disponível no site da Rastrewin, incluindo, mas não se limitando a, textos, imagens, ilustrações, designs, ícones, fotografias, programas de computador, videoclipes e áudios, constitui propriedade intelectual protegida tanto pela legislação nacional quanto por tratados internacionais sobre direitos autorais e propriedade industrial. Essa propriedade engloba não apenas materiais diretamente produzidos e publicados por nós, mas também conteúdos que são utilizados sob licença ou permissão de terceiros, garantindo que todos os direitos sejam respeitados conforme as normativas vigentes.',
      'Ao acessar nosso site, você recebe uma licença limitada, não exclusiva e revogável para visualizar e usar o conteúdo para fins pessoais e não comerciais. Isso implica que qualquer reprodução, distribuição, transmissão ou modificação do conteúdo, sem a devida autorização escrita da Rastrewin, é estritamente proibida. Tal restrição visa proteger os direitos de propriedade intelectual associados aos materiais disponibilizados, assegurando que sua utilização não infrinja os direitos dos criadores ou detentores desses direitos, além de promover um ambiente de respeito e valorização da criatividade e inovação.',
    ],
  },
  {
    title: '5. Cookies e Mais',
    body: [
      'Utilizamos cookies para melhorar sua experiência, coletando informações anônimas durante sua visita, como suas preferências de idioma, duração da visita, páginas acessadas, e outras estatísticas de uso. Esses dados nos ajudam a personalizar seu conteúdo, otimizar a navegação, melhorar continuamente o site em design e funcionalidade, e garantir sua segurança online. Esta prática é essencial para nos permitir oferecer um serviço mais ajustado às suas necessidades e resolver qualquer problema que possa surgir mais rapidamente.',
      'Se você preferir limitar ou recusar o uso de cookies, a configuração pode ser ajustada através do seu navegador. Isso pode afetar a sua experiência no site, pois algumas funcionalidades dependem dos cookies para funcionar corretamente. Entendemos a importância do controle sobre suas informações e queremos que você saiba que, ao ajustar as configurações para bloquear cookies, algumas partes do nosso site podem não oferecer a experiência completa pretendida.',
    ],
  },
  {
    title: '6. Explorando Links Externos',
    body: [
      'Nosso site pode incluir links para sites externos que achamos que podem ser do seu interesse. Note que não temos controle sobre esses sites externos e, portanto, não somos responsáveis pelo seu conteúdo ou políticas.',
    ],
  },
  {
    title: '7. Mudanças e Atualizações',
    body: [
      'A evolução é parte de como operamos, o que significa que estes Termos de Uso podem passar por atualizações para refletir melhor as mudanças em nossos serviços ou na legislação. Sempre que isso acontecer, você encontrará a versão mais recente disponível aqui. Se as mudanças forem significativas, faremos o possível para notificá-lo através dos meios de contato que você nos forneceu.',
      'Continuar a acessar o site após essas mudanças indica que você concorda com os novos termos. Se, por qualquer motivo, você não concordar com as atualizações, pedimos que não continue utilizando nosso site e serviços.',
    ],
  },
];

export default function Terms() {
  return (
    <div className="auth-page">
      <div className="auth-frame">
        <nav className="nav">
          <a href="/"><Logo /></a>
          <a href="/" className="nav-hide" style={{ font: '500 15.5px var(--f-body)', color: 'var(--txt-2)', paddingRight: 16 }}>Voltar ao início</a>
        </nav>
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '56px 20px 72px', display: 'grid', gap: 28 }}>
          <h1 className="display" style={{ fontSize: 'clamp(36px, 6vw, 56px)', lineHeight: 1.05 }}>
            Termos de <span className="accent" style={{ fontSize: '1.14em' }}>Uso</span> e Serviço da Rastrewin
          </h1>
          <p style={{ font: '500 17px/1.65 var(--f-body)', color: 'var(--txt-2)' }}>
            Seja Bem-Vindo ao site da Rastrewin. Antes de explorar tudo o que temos a oferecer, é importante que você entenda e concorde com algumas regras básicas que regem o uso do nosso site{' '}
            <a href="https://rastrewin.com/" style={{ textDecoration: 'underline' }}>https://rastrewin.com/</a>, e qualquer outro serviço digital que nós oferecemos, como lojas e plataformas de e-commerce.
          </p>
          <p style={{ font: '500 17px/1.65 var(--f-body)', color: 'var(--txt-2)' }}>
            Ao usar nosso site e serviços, você automaticamente concorda em seguir as regras que estabelecemos aqui. Caso não concorde com algo, por favor, considere não usar nossos serviços. É muito importante para nós que você se sinta seguro e informado a todo momento.
          </p>
          {SECTIONS.map((s) => (
            <section key={s.title} style={{ display: 'grid', gap: 12 }}>
              <h2 className="display" style={{ fontSize: 26 }}>{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} style={{ font: '500 16px/1.7 var(--f-body)', color: 'var(--txt-2)' }}>{p}</p>
              ))}
            </section>
          ))}
          <section style={{ display: 'grid', gap: 12, borderTop: '1px solid var(--line)', paddingTop: 28 }}>
            <h2 className="display" style={{ fontSize: 26 }}>Dúvidas ou Comentários?</h2>
            <p style={{ font: '500 16px/1.7 var(--f-body)', color: 'var(--txt-2)' }}>
              Se tiver dúvidas sobre estes termos, não hesite em nos contatar através do e-mail{' '}
              <a href="mailto:contatosimintermediacoes@gmail.com" style={{ textDecoration: 'underline' }}>contatosimintermediacoes@gmail.com</a>.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
