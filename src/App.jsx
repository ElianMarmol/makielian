import { useState, useRef, useEffect } from 'react';
import { categories } from './data';
import { supabase } from './supabase';

function App() {
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null); // This is actually the selected Adventure
  const [localPhotos, setLocalPhotos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState("");

  const fileInputRef = useRef(null);
  const addPhotosInputRef = useRef(null);

  // Drag and Drop Refs
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const isDraggingItem = useRef(false);

  // Migration functions
  const importBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) {
          alert("Migrando tus fotos a la nube... Esto puede tardar uno o dos minutos. Por favor, no cierres esta pestaña.");
          
          for (const adventure of importedData) {
            const uploadedUrls = [];
            
            if (adventure.urls && adventure.urls.length > 0) {
              for (let i = 0; i < adventure.urls.length; i++) {
                const dataUrl = adventure.urls[i];
                
                if (!dataUrl.startsWith('data:')) {
                  uploadedUrls.push(dataUrl);
                  continue;
                }

                try {
                  const res = await fetch(dataUrl);
                  const blob = await res.blob();
                  const imgFile = new File([blob], `migrated_${Date.now()}_${i}.jpg`, { type: blob.type });
                  
                  const fileExt = imgFile.name.split('.').pop();
                  const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
                  const filePath = `photos/${fileName}`;

                  const { error: uploadError } = await supabase.storage
                    .from('album_photos')
                    .upload(filePath, imgFile);
                    
                  if (!uploadError) {
                    const { data } = supabase.storage.from('album_photos').getPublicUrl(filePath);
                    uploadedUrls.push(data.publicUrl);
                  }
                } catch(err) {
                  console.error("Error subiendo imagen migrada", err);
                }
              }
            }
            
            let dateToUse = new Date().toISOString();
            if (typeof adventure.id === 'number' && adventure.id > 10000) {
              dateToUse = new Date(adventure.id).toISOString();
            }
            
            await supabase.from('adventures').insert([{
              category: adventure.category || 'salidas',
              descripcion: adventure.descripcion || '',
              urls: uploadedUrls,
              created_at: dateToUse
            }]);
          }
          
          alert("¡Migración completa! Todas tus fotos están seguras en Supabase.");
          fetchAdventures(); 
        } else {
          alert("El archivo no tiene el formato correcto.");
        }
      } catch (err) {
        console.error(err);
        alert("Error al procesar el archivo de backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const fetchAdventures = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('adventures')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching adventures:', error);
    } else {
      setLocalPhotos(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAdventures();
  }, []);

  const handleDragStart = (e, id) => {
    isDraggingItem.current = true;
    dragItem.current = id;
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    
    const target = e.currentTarget;
    setTimeout(() => { 
      if (target) target.style.opacity = '0.4'; 
    }, 0);
  };

  const handleDragEnter = (e, id) => {
    e.preventDefault();
    dragOverItem.current = id;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnd = async (e) => {
    e.currentTarget.style.opacity = '1';
    
    setTimeout(() => {
      isDraggingItem.current = false;
    }, 100);
    
    if (!dragItem.current || !dragOverItem.current || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const newPhotos = [...localPhotos];
    const draggedIndex = newPhotos.findIndex(p => p.id === dragItem.current);
    const overIndex = newPhotos.findIndex(p => p.id === dragOverItem.current);
    
    if (draggedIndex !== -1 && overIndex !== -1) {
      const draggedItemContent = newPhotos[draggedIndex];
      newPhotos.splice(draggedIndex, 1);
      newPhotos.splice(overIndex, 0, draggedItemContent);
      
      // Update UI immediately for optimism
      setLocalPhotos(newPhotos);
      
      // We are ignoring persistent reordering in DB for simplicity right now 
      // since the DB orders by created_at. To do real reordering in DB we'd need an `order_index` column.
    }

    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handlePhotoClick = (photo) => {
    if (isDraggingItem.current) return;
    setSelectedPhoto(photo);
  };

  const closeModal = () => {
    setSelectedPhoto(null);
    setIsEditing(false);
  };

  const filteredPhotos = activeCategory 
    ? localPhotos.filter(p => p.category === activeCategory) 
    : [];

  const uploadImagesToSupabase = async (files) => {
    const urls = [];
    for (const file of Array.from(files)) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('album_photos')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading image:', uploadError);
        continue;
      }

      const { data } = supabase.storage
        .from('album_photos')
        .getPublicUrl(filePath);

      urls.push(data.publicUrl);
    }
    return urls;
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    alert("Subiendo fotos a la nube... esto puede tardar unos segundos.");
    const publicUrls = await uploadImagesToSupabase(files);
    
    if (publicUrls.length === 0) return;

    const newAdventure = {
      category: activeCategory,
      descripcion: "Nueva aventura... (Haz clic para editar)",
      urls: publicUrls
    };

    const { data, error } = await supabase
      .from('adventures')
      .insert([newAdventure])
      .select();

    if (error) {
      console.error('Error creating adventure:', error);
      alert('Hubo un error al crear la aventura');
    } else if (data) {
      setLocalPhotos([...localPhotos, data[0]]);
    }
    
    e.target.value = null;
  };

  const handleAddPhotosToExisting = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    alert("Subiendo más fotos a la nube...");
    const newUrls = await uploadImagesToSupabase(files);
    if (newUrls.length === 0) return;

    const updatedUrls = [...(selectedPhoto.urls || []), ...newUrls];

    const { error } = await supabase
      .from('adventures')
      .update({ urls: updatedUrls })
      .eq('id', selectedPhoto.id);

    if (error) {
      console.error('Error updating photos:', error);
    } else {
      const updatedPhotos = localPhotos.map(p => 
        p.id === selectedPhoto.id ? { ...p, urls: updatedUrls } : p
      );
      setLocalPhotos(updatedPhotos);
      setSelectedPhoto(prev => ({ ...prev, urls: updatedUrls }));
    }
    
    e.target.value = null;
  };

  const handleSaveDescription = async () => {
    const { error } = await supabase
      .from('adventures')
      .update({ descripcion: editDesc })
      .eq('id', selectedPhoto.id);

    if (error) {
      console.error('Error updating description:', error);
    } else {
      const updated = localPhotos.map(p => 
        p.id === selectedPhoto.id ? { ...p, descripcion: editDesc } : p
      );
      setLocalPhotos(updated);
      setSelectedPhoto({ ...selectedPhoto, descripcion: editDesc });
      setIsEditing(false);
    }
  };

  const handleDeleteAdventure = async () => {
    if (window.confirm('¿Estás seguro de que deseas despegar toda esta aventura del álbum (y de la nube)?')) {
      const { error } = await supabase
        .from('adventures')
        .delete()
        .eq('id', selectedPhoto.id);

      if (error) {
        console.error('Error deleting:', error);
      } else {
        setLocalPhotos(localPhotos.filter(p => p.id !== selectedPhoto.id));
        closeModal();
      }
    }
  };

  const handleDeleteSpecificPhoto = async (indexToRemove) => {
    if (window.confirm('¿Quitar esta foto específica de la aventura?')) {
      const newUrls = selectedPhoto.urls.filter((_, i) => i !== indexToRemove);
      
      if (newUrls.length === 0) {
        handleDeleteAdventure();
        return;
      }
      
      const { error } = await supabase
        .from('adventures')
        .update({ urls: newUrls })
        .eq('id', selectedPhoto.id);

      if (error) {
        console.error('Error removing specific photo:', error);
      } else {
        const updated = localPhotos.map(p => 
          p.id === selectedPhoto.id ? { ...p, urls: newUrls } : p
        );
        setLocalPhotos(updated);
        setSelectedPhoto({ ...selectedPhoto, urls: newUrls });
      }
    }
  };

  return (
    <div className="min-h-screen font-handwriting selection:bg-[#d4a373] text-[#4a3f35] overflow-x-hidden">
      <header className={`text-center px-4 relative flex flex-col items-center ${activeCategory ? 'py-6 md:py-8' : 'py-6 md:py-10'}`}>
        {!activeCategory ? (
          <div className="flex flex-col items-center animate-in zoom-in duration-500">
            <img 
              src="/logomakielian.jpg" 
              alt="Maki y Elian Logo" 
              className="w-32 h-32 md:w-40 md:h-40 object-cover rounded-full shadow-lg mb-4 md:mb-6 border-4 border-[#fffdf5] ring-4 ring-[#8c5a35]/20 hover:scale-105 transition-transform duration-300"
            />
            <h1 
              className="text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-title font-bold text-[#8c5a35] tracking-widest drop-shadow-sm cursor-pointer transition-transform hover:scale-105 px-2" 
              onClick={() => setActiveCategory(null)}
              title="Volver a la Portada"
            >
              AVENTURAS DE MAKI Y ELIAN
            </h1>
          </div>
        ) : (
          <button 
            onClick={() => setActiveCategory(null)}
            className="px-6 md:px-8 py-2 md:py-3 bg-[#8c5a35] text-[#f4ecd8] font-bold text-xl md:text-2xl font-title tracking-wider rounded-full hover:bg-[#6c4224] transition-colors shadow-md w-full max-w-[250px]"
          >
            &larr; Volver al Índice
          </button>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
        {!activeCategory ? (
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-8 md:gap-16 mt-6 md:mt-10 items-center">
            {categories.map((cat, i) => (
              <div 
                key={cat.id} 
                onClick={() => setActiveCategory(cat.id)}
                className="relative w-full max-w-[280px] h-64 sm:w-64 sm:h-72 md:w-72 md:h-80 bg-[#fffdf5] p-6 shadow-xl cursor-pointer transition-all duration-300 hover:scale-105 hover:z-10 flex flex-col justify-center items-center text-center group"
                style={{ transform: `rotate(${i % 2 === 0 ? '-3' : '4'}deg)` }}
              >
                <div className="tape"></div>
                <div className="text-6xl md:text-8xl mb-4 filter drop-shadow-sm group-hover:animate-bounce">{cat.icon}</div>
                <h2 className="text-4xl md:text-5xl font-title font-bold text-[#5c4033] border-b-2 border-dashed border-[#5c4033] pb-2">
                  {cat.label}
                </h2>
              </div>
            ))}
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            <h2 className="text-5xl md:text-7xl font-title font-bold text-center mb-10 md:mb-16 text-[#6c4224]">
              {categories.find(c => c.id === activeCategory)?.label}
            </h2>
            
            <input 
              type="file" 
              accept="image/*"
              multiple
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload}
            />

            {isLoading ? (
              <div className="text-center text-3xl font-title text-[#8c5a35] animate-pulse">
                Cargando aventuras desde la nube...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 md:gap-16 items-center">
                {filteredPhotos.map((photo, i) => {
                  const coverImage = photo.urls && photo.urls.length > 0 ? photo.urls[0] : "";
                  return (
                    <div 
                      key={photo.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, photo.id)}
                      onDragEnter={(e) => handleDragEnter(e, photo.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => { e.preventDefault(); dragOverItem.current = photo.id; }}
                      className="relative bg-[#fffdf5] p-3 pb-14 md:p-5 md:pb-20 shadow-lg border border-gray-200 cursor-pointer hover:scale-105 hover:shadow-2xl transition-all duration-300 hover:z-10 group flex flex-col active:cursor-grabbing"
                      style={{ transform: `rotate(${i % 2 === 0 ? '2' : '-3'}deg)` }}
                      onClick={() => handlePhotoClick(photo)}
                      title="Arrastra para reordenar (local) o haz clic para ver"
                    >
                      <div className="tape"></div>
                      {photo.urls && photo.urls.length > 1 && (
                        <div className="absolute top-4 right-4 z-20 bg-black/60 text-white text-xs font-sans px-2 py-1 rounded-full shadow-md">
                          1/{photo.urls.length}
                        </div>
                      )}
                      <div className="w-full aspect-square overflow-hidden bg-neutral-200 shadow-inner ring-1 ring-black/5 relative pointer-events-none">
                        {coverImage && (
                          <img 
                            src={coverImage} 
                            alt={photo.descripcion}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="absolute bottom-2 md:bottom-5 left-0 right-0 text-center px-4 pointer-events-none">
                        <p className="text-2xl md:text-3xl text-[#3b2f2f] truncate px-2">
                          {photo.descripcion}
                        </p>
                      </div>
                    </div>
                  );
                })}

                <div 
                  className="relative bg-transparent border-4 border-dashed border-[#8c5a35]/30 p-3 pb-14 md:p-5 md:pb-20 shadow-none cursor-pointer hover:bg-[#fffdf5]/50 hover:shadow-lg hover:border-[#8c5a35]/60 transition-all duration-300 flex flex-col justify-center items-center text-center opacity-80 hover:opacity-100 min-h-[300px]"
                  style={{ transform: `rotate(${filteredPhotos.length % 2 === 0 ? '3' : '-2'}deg)` }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Pegar nueva aventura en la nube"
                >
                  <div className="text-6xl md:text-7xl text-[#8c5a35]/40 mb-2 transition-transform hover:scale-110">+</div>
                  <p className="text-3xl md:text-4xl font-handwriting text-[#8c5a35]">Nueva aventura</p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer de Migración (Solo visible en el inicio) */}
      {!activeCategory && (
        <footer className="text-center pb-12 opacity-40 hover:opacity-100 transition-opacity duration-300 font-sans flex flex-col items-center mt-10">
          <p className="text-[#8c5a35] text-sm mb-3">Herramientas</p>
          <div className="flex gap-4">
            <label 
              className="text-xs bg-[#eaddc5] text-[#5c4033] px-4 py-2 rounded-full shadow-sm hover:bg-[#d4a373] hover:text-white transition-colors cursor-pointer border border-[#8c5a35]/20"
              title="Migrar tus fotos locales a la nube"
            >
              Importar Backup a la Nube
              <input type="file" accept=".json" className="hidden" onChange={importBackup} />
            </label>
          </div>
        </footer>
      )}

      {/* Modal Fotografía Extendida */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={closeModal}
        >
          <div 
            className="relative max-w-6xl w-full max-h-[95vh] overflow-y-auto bg-[#fffdf5] p-4 pt-10 md:p-8 rounded-sm shadow-2xl flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-300"
            style={{ transform: 'rotate(1deg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tape" style={{ width: '150px', top: '5px', transform: 'translateX(-50%) rotate(-1deg)' }}></div>
            <button 
              className="absolute top-2 right-2 md:-top-5 md:-right-5 z-20 w-10 h-10 md:w-12 md:h-12 bg-[#8c5a35] hover:bg-[#6c4224] rounded-full flex items-center justify-center text-white text-2xl md:text-3xl font-bold shadow-lg transition-colors border-2 border-white"
              onClick={closeModal}
              title="Cerrar"
            >
              &times;
            </button>
            
            <div className="w-full md:w-3/5 bg-gray-200 shadow-inner border border-gray-300 p-2 relative mt-4 md:mt-0 flex flex-col gap-4 overflow-y-auto max-h-[50vh] md:max-h-[75vh] snap-y snap-mandatory rounded-sm">
              {selectedPhoto.urls && selectedPhoto.urls.map((u, idx) => (
                <div key={idx} className="w-full relative group snap-center bg-gray-100 flex-shrink-0 flex items-center justify-center p-1 border border-gray-200">
                  <img 
                    src={u} 
                    alt={`Aventura ${idx + 1}`}
                    className="w-full h-auto max-h-[50vh] md:max-h-[70vh] object-contain shadow-sm"
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteSpecificPhoto(idx); }}
                    className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                    title="Quitar foto"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            
            <div className="w-full md:w-2/5 p-4 md:p-10 flex flex-col justify-start md:justify-center relative bg-[#fffdf5]">
              
              <input 
                type="file" 
                accept="image/*"
                multiple
                className="hidden" 
                ref={addPhotosInputRef} 
                onChange={handleAddPhotosToExisting}
              />

              {isEditing ? (
                <div className="flex flex-col w-full h-full justify-center space-y-4">
                  <textarea 
                    className="w-full bg-[#f4ecd8] border-2 border-dashed border-[#8c5a35]/50 p-4 rounded-md text-2xl md:text-3xl font-handwriting text-[#4a3f35] focus:outline-none focus:border-[#8c5a35] resize-none h-32 md:h-40"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <button 
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 md:px-4 md:py-2 text-lg md:text-xl font-handwriting text-[#8c5a35] hover:bg-black/5 rounded-md transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSaveDescription}
                      className="px-4 py-1 md:px-6 md:py-2 text-lg md:text-xl font-handwriting bg-[#8c5a35] text-[#fffdf5] hover:bg-[#6c4224] rounded-md transition-colors shadow-md"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap justify-end gap-2 mb-4 md:absolute md:top-6 md:right-6 md:mb-0">
                    <button 
                      onClick={() => addPhotosInputRef.current?.click()}
                      className="px-3 py-1 border-2 border-emerald-700/30 text-emerald-700 font-title text-lg md:text-xl rounded-full hover:bg-emerald-700 hover:text-white transition-colors bg-white/50"
                      title="Agregar más fotos a esta aventura"
                    >
                      + Fotos
                    </button>
                    <button 
                      onClick={() => { setIsEditing(true); setEditDesc(selectedPhoto.descripcion); }}
                      className="px-3 py-1 border-2 border-[#8c5a35]/30 text-[#8c5a35] font-title text-lg md:text-xl rounded-full hover:bg-[#8c5a35] hover:text-white transition-colors bg-white/50"
                      title="Editar Descripción"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={handleDeleteAdventure}
                      className="px-3 py-1 border-2 border-red-800/30 text-red-800 font-title text-lg md:text-xl rounded-full hover:bg-red-800 hover:text-white transition-colors bg-white/50"
                      title="Borrar Aventura Completa"
                    >
                      Borrar Aventura
                    </button>
                  </div>
                  <p className="text-3xl sm:text-4xl md:text-5xl font-handwriting text-[#4a3f35] leading-relaxed mt-4 md:mt-16">
                    {selectedPhoto.descripcion}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
