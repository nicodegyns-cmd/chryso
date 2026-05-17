const fs = require('fs');
let c = fs.readFileSync('components/PrestationsTable.jsx', 'utf8');

const marker = 'JUSTIFICATIF {Number(exp.amount';
const markerIdx = c.indexOf(marker);
const blockStart = c.lastIndexOf('                      <div>\r\n                        <div style={{fontWeight:600', markerIdx);
const blockEndMarker = '\r\n                    </div>\r\n                  ))}';
const blockEndIdx = c.indexOf(blockEndMarker, markerIdx);

const oldBlock = c.substring(blockStart, blockEndIdx);

// Get the exact broken-emoji character for the camera icon (codepoint 65533 = U+FFFD)
const brokenEmoji1 = c[markerIdx - 1]; // The broken camera emoji
// Get the broken PDF and trash emojis from the block
const pdfEmojiIdx = oldBlock.indexOf('<span style={{fontSize:20}}>') + '<span style={{fontSize:20}}>'.length;
const pdfEmojiEnd = oldBlock.indexOf('</span>', pdfEmojiIdx);
const pdfEmojiStr = oldBlock.substring(pdfEmojiIdx, pdfEmojiEnd); // The broken 📄 emoji

const trashBtnIdx = oldBlock.indexOf('>\r\n                            >', oldBlock.indexOf('cursor:pointer,fontWeight:600')) + 2;
// Actually let's just find the Supprimer button text
const supprimerStart = oldBlock.indexOf('> Supprimer</button>') - 3;
const trashEmojiStr = oldBlock.substring(supprimerStart, oldBlock.indexOf('> Supprimer</button>'));

// Build the new block with is_travel_zone guard
const newBlock = `                      <div>
                        {exp.is_travel_zone ? (
                          <div style={{fontSize:13,color:'#1d4ed8',fontWeight:500,padding:'6px 10px',background:'#eff6ff',borderRadius:6,border:'1px solid #93c5fd'}}>
                            🚗 Frais de déplacement officiel — aucun justificatif requis
                          </div>
                        ) : (
                          <>
                            <div style={{fontWeight:600,marginBottom:4,fontSize:12,color:'#92400e'}}>${brokenEmoji1} JUSTIFICATIF {Number(exp.amount||0)>0 && <span style={{color:'#dc2626'}}>*</span>}</div>
                            {!exp.proof_image && (
                              <input type="file" accept="image/*,application/pdf" style={{fontSize:14}} onChange={async (e)=>{
                                const f = e.target.files && e.target.files[0]
                                if (!f) return
                                const data = await new Promise((res,rej)=>{
                                  const reader = new FileReader()
                                  reader.onload = ()=>res(reader.result)
                                  reader.onerror = rej
                                  reader.readAsDataURL(f)
                                })
                                const next = (editing.expenses||[]).map((x,i)=>i===idx?{...x,proof_image:data,proof_name:f.name}:x)
                                setEditing({...editing, expenses: next})
                              }} />
                            )}
                            {Number(exp.amount||0)>0&&!exp.proof_image&&<div style={{fontSize:11,color:'#dc2626',marginTop:3}}>Obligatoire si montant renseigné</div>}
                            {exp.proof_image && (
                              <div style={{marginTop:6}}>
                                {exp.proof_image.startsWith('data:application/pdf') ? (
                                  <div style={{padding:'10px 12px',background:'#fff7ed',border:'2px solid #fcd34d',borderRadius:6,display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                                    <span style={{fontSize:20}}>${pdfEmojiStr}</span>
                                    <span style={{fontSize:13,color:'#92400e',fontWeight:600,wordBreak:'break-all'}}>{exp.proof_name || 'document.pdf'}</span>
                                  </div>
                                ) : (
                                  <img src={exp.proof_image} alt="ticket" style={{maxWidth:'100%',maxHeight:160,border:'2px solid #fcd34d',borderRadius:6,display:'block',marginBottom:6}} />
                                )}
                                <button
                                  type="button"
                                  onClick={()=>{
                                    const next = (editing.expenses||[]).map((x,i)=>i===idx?{...x,proof_image:null,proof_name:null}:x)
                                    setEditing({...editing, expenses: next})
                                  }}
                                  style={{padding:'5px 10px',background:'#fee2e2',color:'#991b1b',borderRadius:5,border:'1px solid #fca5a5',cursor:'pointer',fontWeight:600,fontSize:12}}
                                >${trashEmojiStr} Supprimer</button>
                              </div>
                            )}
                          </>
                        )}
                      </div>`;

if (!oldBlock.includes('JUSTIFICATIF')) {
  console.error('Could not find JUSTIFICATIF in old block!');
  process.exit(1);
}

const newContent = c.substring(0, blockStart) + newBlock + c.substring(blockEndIdx);
fs.writeFileSync('components/PrestationsTable.jsx', newContent, 'utf8');
console.log('Done! Replaced block successfully.');
console.log('New block length:', newBlock.length, 'Old block length:', oldBlock.length);
